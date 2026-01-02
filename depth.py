import cv2
import numpy as np
import torch
import ssl

# Фикс SSL для загрузки весов
try:
    _create_unverified_https_context = ssl._create_unverified_context
except AttributeError:
    pass
else:
    ssl._create_default_https_context = _create_unverified_https_context

# Глобальные переменные
device = torch.device("cuda") if torch.cuda.is_available() else torch.device("cpu")

# Кэш загруженных моделей: { 'MiDaS_small': (model, transform), ... }
loaded_models_cache = {}

# Хранилище сырых данных глубины для калибровки
last_raw_depth_map = None

depth_models_initialized = False

def get_midas_model(model_type_alias="small"):
    """
    Загружает и возвращает модель и трансформации по алиасу.
    Поддерживаемые алиасы: small, hybrid, large.
    """
    global loaded_models_cache, device, depth_models_initialized

    # Маппинг простых имен в названия моделей Torch Hub
    # DPT_Large - самая точная, но тяжелая
    # DPT_Hybrid - баланс скорости и точности
    # MiDaS_small - для реалтайма на CPU
    model_map = {
        "small": "MiDaS_small",
        "hybrid": "DPT_Hybrid",
        "large": "DPT_Large"
    }

    hub_name = model_map.get(model_type_alias.lower(), "MiDaS_small")

    # Если модель уже в памяти, возвращаем её
    if hub_name in loaded_models_cache:
        return loaded_models_cache[hub_name]

    print(f"⬇️ Loading Depth Model: {hub_name} on {device}...")
    
    try:
        # Загружаем веса
        model = torch.hub.load("intel-isl/MiDaS", hub_name)
        model.to(device)
        model.eval()

        # Загружаем трансформации (они разные для разных архитектур)
        midas_transforms = torch.hub.load("intel-isl/MiDaS", "transforms")
        
        if hub_name == "MiDaS_small":
            transform = midas_transforms.small_transform
        elif hub_name in ["DPT_Large", "DPT_Hybrid"]:
            transform = midas_transforms.dpt_transform
        else:
            transform = midas_transforms.default_transform

        # Сохраняем в кэш
        loaded_models_cache[hub_name] = (model, transform)
        print(f"✅ Model {hub_name} loaded successfully.")

        depth_models_initialized = True

        return model, transform

    except Exception as e:
        print(f"❌ Failed to load {hub_name}: {e}")
        return None, None

def init_depth_models():
    """Предзагрузка дефолтной модели при старте (необязательно, но полезно для скорости)"""
    get_midas_model("small")

# --- Математика DCP ---
def get_dark_channel(image, window_size):
    min_channel = np.min(image, axis=2)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (window_size, window_size))
    return cv2.erode(min_channel, kernel)

def get_atmospheric_light(image, dark_channel, top_percent=0.1):
    flat_dark_channel = dark_channel.flatten()
    flat_image = image.reshape(-1, 3)
    num_pixels = len(flat_dark_channel)
    num_top_pixels = max(int(num_pixels * top_percent / 100), 1)
    indices = np.argsort(flat_dark_channel)[::-1][:num_top_pixels]
    return np.mean(flat_image[indices], axis=0)

def estimate_transmission(image, atmospheric_light, window_size, omega=0.95):
    normalized_image = image / (atmospheric_light + 1e-6)
    dark_channel_normalized = get_dark_channel(normalized_image, window_size)
    return 1 - omega * dark_channel_normalized

# --- Применение (Wrappers) ---

def apply_depth_dcp(frame, **params):
    window_size = int(params.get('window_size', 15))
    omega = float(params.get('omega', 0.95))
    
    image_float = frame.astype(np.float32) / 255.0
    dark_channel = get_dark_channel(image_float, window_size)
    atmospheric_light = get_atmospheric_light(image_float, dark_channel)
    transmission = estimate_transmission(image_float, atmospheric_light, window_size, omega)
    
    depth_map = 1.0 - transmission 
    depth_map_u8 = (depth_map * 255).astype(np.uint8)
    depth_colormap = cv2.applyColorMap(depth_map_u8, cv2.COLORMAP_INFERNO)
    
    return depth_colormap, {"method": "DCP", "window_size": window_size}

def apply_depth_midas(frame, **params):
    global last_raw_depth_map, device
    
    # 1. Выбор модели (small / hybrid / large)
    # По умолчанию берем small, если не указано иное
    requested_model_type = params.get("model_type", "small")
    
    model, transform = get_midas_model(requested_model_type)
    
    if model is None:
        return frame, {"error": f"Failed to load model: {requested_model_type}"}

    # 2. Инференс
    colormap_name = params.get("colormap", "inferno").upper()
    img_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    
    input_batch = transform(img_rgb).to(device)

    with torch.no_grad():
        prediction = model(input_batch)
        prediction = torch.nn.functional.interpolate(
            prediction.unsqueeze(1),
            size=img_rgb.shape[:2],
            mode="bicubic",
            align_corners=False,
        ).squeeze()

    # Сохраняем сырой результат
    last_raw_depth_map = prediction.cpu().numpy()

    # 3. Визуализация
    depth_min = last_raw_depth_map.min()
    depth_max = last_raw_depth_map.max()
    
    if depth_max - depth_min > 1e-6:
        depth_map_norm = (last_raw_depth_map - depth_min) / (depth_max - depth_min)
    else:
        depth_map_norm = np.zeros_like(last_raw_depth_map)
        
    depth_map_u8 = (depth_map_norm * 255).astype(np.uint8)
    colormap_const = getattr(cv2, f"COLORMAP_{colormap_name}", cv2.COLORMAP_INFERNO)
    depth_colormap = cv2.applyColorMap(depth_map_u8, colormap_const)

    # 4. Калибровка и Сетка
    result_params = {
        "model": requested_model_type, 
        "colormap": colormap_name
    }
    
    p_x, p_y, p_dist = params.get('x'), params.get('y'), params.get('dist')
    p_C = params.get('C')
    p_grid = params.get('grid') # Размер сетки (например, 8)

    calibration_const = None

    # А) Логика вычисления C (Калибровка)
    if p_x is not None and p_y is not None and p_dist is not None:
        try:
            x, y, real_dist = int(p_x), int(p_y), float(p_dist)
            h, w = last_raw_depth_map.shape
            
            if 0 <= x < w and 0 <= y < h:
                raw_val = last_raw_depth_map[y, x]
                calibration_const = real_dist * raw_val
                
                result_params['calculated_C'] = f"{calibration_const:.2f}"
                result_params['info'] = "CALIBRATION OK"
                
                # Рисуем референсную точку
                cv2.circle(depth_colormap, (x, y), 6, (0, 255, 0), -1) # Зеленая точка
                cv2.putText(depth_colormap, f"{real_dist}m (Ref)", (x + 10, y), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        except ValueError:
            result_params['error'] = "Invalid calibration params"

    # Б) Логика использования готовой C
    elif p_C is not None:
        try:
            calibration_const = float(p_C)
        except ValueError: pass

    # Отрисовка сетки (если есть C)
    if calibration_const is not None:
        result_params['used_C'] = f"{calibration_const:.2f}"
        
        h, w = frame.shape[:2]
        
        # Определяем размер сетки (по умолчанию 8x8)
        try:
            grid_size = int(p_grid) if p_grid else 8
        except: grid_size = 8
        
        result_params['grid_size'] = grid_size

        step_y = h // grid_size
        step_x = w // grid_size
        
        # Рисуем точки
        for r in range(1, grid_size):
            for c in range(1, grid_size):
                cx, cy = c * step_x, r * step_y
                
                raw_val = last_raw_depth_map[cy, cx]
                if raw_val > 0:
                    dist_meters = calibration_const / raw_val
                    
                    # Цвет текста зависит от расстояния (близко - крупно, далеко - мелко)
                    font_scale = 0.5
                    thickness = 1
                    
                    text = f"{dist_meters:.1f}m"
                    
                    cv2.circle(depth_colormap, (cx, cy), 3, (255, 255, 255), -1)
                    # Черная обводка для контраста
                    cv2.putText(depth_colormap, text, (cx + 5, cy - 5), 
                                cv2.FONT_HERSHEY_SIMPLEX, font_scale, (0, 0, 0), thickness + 2)
                    # Белый текст
                    cv2.putText(depth_colormap, text, (cx + 5, cy - 5), 
                                cv2.FONT_HERSHEY_SIMPLEX, font_scale, (255, 255, 255), thickness)

    return depth_colormap, result_params