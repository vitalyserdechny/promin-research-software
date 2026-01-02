import cv2
import numpy as np
import depth

from neural_models.zerodce.zerodce import ZeroDCEProcessor

zero_dce_processor = None

def init_nn_processors():
    global zero_dce_processor
    zero_dce_processor = ZeroDCEProcessor()

def get_dark_channel(image, window_size):
    """
    Вычисляет темный канал изображения.
    """
    min_channel = np.min(image, axis=2) # Минимальное значение среди R, G, B для каждого пикселя
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (window_size, window_size))
    dark_channel = cv2.erode(min_channel, kernel) # Применение операции эрозии
    return dark_channel

def get_atmospheric_light(image, dark_channel, top_percent=0.1):
    """
    Оценивает атмосферный свет (A).
    """
    # Выбираем 0.1% самых ярких пикселей в темном канале
    flat_dark_channel = dark_channel.flatten()
    flat_image = image.reshape(-1, 3)

    num_pixels = len(flat_dark_channel)
    num_top_pixels = int(num_pixels * top_percent / 100) # Используем top_percent как процент, а не долю

    # Получаем индексы пикселей с наибольшим значением в темном канале
    indices = np.argsort(flat_dark_channel)[::-1][:num_top_pixels]

    # Находим среднее значение атмосферного света по этим пикселям
    atmospheric_light = np.mean(flat_image[indices], axis=0)
    return atmospheric_light

def estimate_transmission(image, atmospheric_light, window_size, omega=0.95):
    """
    Оценивает карту пропускания (transmission map).
    """
    normalized_image = image / atmospheric_light # Нормализация изображения
    dark_channel_normalized = get_dark_channel(normalized_image, window_size)
    transmission = 1 - omega * dark_channel_normalized
    return transmission

def dehaze(image, window_size=15, omega=0.95, t0=0.1, atmospheric_light_top_percent=0.1):
    """
    Удаляет дымку с изображения с помощью Dark Channel Prior.
    
    Args:
        image (np.array): Входное изображение BGR (uint8).
        window_size (int): Размер окна для вычисления темного канала (должно быть нечетным).
        omega (float): Параметр для сохранения некоторой дымки (обычно 0.95).
        t0 (float): Минимальный порог пропускания для предотвращения чрезмерного шума.
        atmospheric_light_top_percent (float): Процент самых ярких пикселей в темном канале
                                             для оценки атмосферного света (например, 0.1%).

    Returns:
        np.array: Изображение без дымки (uint8).
    """
    # Нормализация изображения до float (0-1) для расчетов
    image_float = image.astype(np.float32) / 255.0

    # 1. Вычисление темного канала
    dark_channel = get_dark_channel(image_float, window_size)

    # 2. Оценка атмосферного света (A)
    atmospheric_light = get_atmospheric_light(image_float, dark_channel, top_percent=atmospheric_light_top_percent)

    # 3. Оценка карты пропускания (transmission map)
    transmission = estimate_transmission(image_float, atmospheric_light, window_size, omega)
    transmission = np.maximum(transmission, t0) # Установка минимального значения t

    # 4. Восстановление сцены
    # Расширяем атмосферный свет до размеров изображения для поэлементного деления
    atmospheric_light_reshaped = atmospheric_light.reshape(1, 1, 3)

    # Формула восстановления: J = (I - A) / max(t, t0) + A
    restored_image = ((image_float - atmospheric_light_reshaped) / transmission[:, :, np.newaxis]) + atmospheric_light_reshaped
    
    # Ограничиваем значения пикселей в диапазоне [0, 1] и преобразуем обратно в uint8
    restored_image = np.clip(restored_image, 0, 1)
    restored_image = (restored_image * 255).astype(np.uint8)

    return restored_image

def resize_to_32_multiple(image):
    h, w = image.shape[:2]
    new_h = h - (h % 32)
    new_w = w - (w % 32)
    return cv2.resize(image, (new_w, new_h))

def apply_preproc(frame, preproc_method, **params):
    final_params = {}

    # *****************************
    # COLOR TRANSFORMATION
    # *****************************
    if preproc_method == "to_grayscale":
        final_params = {"from": "bgr", "to": "gray"}
        if len(frame.shape) == 2 or frame.shape[2] == 1:
            return frame, final_params  # уже grayscale
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        return gray, final_params 
    elif preproc_method == "to_rgb":
        final_params = {"from": "bgr", "to": "rgb"}
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        return rgb, final_params
    elif preproc_method == "to_hsv":
        final_params = {"from": "bgr", "to": "hsv"}
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        return hsv, final_params
    elif preproc_method == "to_lab":
        final_params = {"from": "bgr", "to": "lab"}
        lab = cv2.cvtColor(frame, cv2.COLOR_BGR2Lab)
        return lab, final_params
    # *****************************
    
    # *****************************
    # Edge Detection Methods
    # *****************************
    elif preproc_method == "canny":
        threshold1 = float(params.get("threshold1", 100))
        threshold2 = float(params.get("threshold2", 200))
        apertureSize = int(params.get("apertureSize", 3))
        L2gradient = params.get("L2gradient", 0)
        L2gradient = (L2gradient == 1)
        final_params = {
            "threshold1": threshold1,
            "threshold2": threshold2,
            "apertureSize": apertureSize,
            "L2gradient": L2gradient
        }
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, threshold1, threshold2, apertureSize=apertureSize, L2gradient=L2gradient)
        return edges, final_params
    elif preproc_method == "sobel":
        dx = int(params.get("dx", 1))
        dy = int(params.get("dy", 0))
        ksize = int(params.get("ksize", 3))
        final_params = {"dx": dx, "dy": dy, "ksize": ksize}
        
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        sobel = cv2.Sobel(gray, cv2.CV_64F, dx, dy, ksize=ksize)
        abs_sobel = np.absolute(sobel)
        sobel_8u = np.uint8(np.clip(abs_sobel, 0, 255))
        return sobel_8u, final_params
    elif preproc_method == "prewitt":
        dx = int(params.get("dx", 1))
        dy = int(params.get("dy", 0))
        final_params = {"dx": dx, "dy": dy}

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        # Ядра Prewitt
        kernelx = np.array([[ -1, 0, 1],
                            [ -1, 0, 1],
                            [ -1, 0, 1]]) if dx == 1 else np.zeros((3,3))
        kernely = np.array([[ 1,  1,  1],
                            [ 0,  0,  0],
                            [-1, -1, -1]]) if dy == 1 else np.zeros((3,3))

        grad_x = cv2.filter2D(gray, cv2.CV_64F, kernelx) if dx == 1 else 0
        grad_y = cv2.filter2D(gray, cv2.CV_64F, kernely) if dy == 1 else 0

        grad = grad_x + grad_y
        abs_grad = np.absolute(grad)
        grad_8u = np.uint8(np.clip(abs_grad, 0, 255))

        return grad_8u, final_params
    elif preproc_method == "laplacian":
        ksize = int(params.get("ksize", 3))
        final_params = {"ksize": ksize}

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        lap = cv2.Laplacian(gray, cv2.CV_64F, ksize=ksize)
        abs_lap = np.absolute(lap)
        lap_8u = np.uint8(np.clip(abs_lap, 0, 255))
        return lap_8u, final_params
    # *****************************
    
    # *****************************
    # Contrast Enhancement Methods
    # *****************************
    elif preproc_method == "clahe":
        clip_limit = float(params.get('clipLimit', 2.0))
        tile_grid_str = params.get('tileGridSize', '8x8')
        final_params = {"clipLimit": clip_limit, "tileGridSize": tile_grid_str}
        try:
            tile_w, tile_h = map(int, tile_grid_str.lower().split('x'))
        except Exception:
            tile_w, tile_h = 8, 8
        # Перевод в LAB
        lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        # CLAHE только на L-канал
        clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(tile_w, tile_h))
        cl = clahe.apply(l)
        # Объединение обратно
        limg = cv2.merge((cl, a, b))
        processed = cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)
        return processed, final_params
    elif preproc_method == "hist_eq":
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        processed = cv2.equalizeHist(gray)
        processed = cv2.cvtColor(processed, cv2.COLOR_GRAY2BGR)
        return processed, final_params
    elif preproc_method == "gamma":
        gamma = float(params.get("g", 1.25))
        final_params = {"g": gamma}
        invGamma = 1.0 / gamma
        table = np.array([(i / 255.0) ** invGamma * 255 for i in np.arange(256)]).astype("uint8")
        return cv2.LUT(frame, table), final_params
    # *****************************

    elif preproc_method == "zero_dce":
        '''
        frame = resize_to_32_multiple(frame)
        # Перевод из BGR в RGB
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        # Приведение к диапазону [0,1]
        data_lowlight = frame_rgb / 255.0
        # Преобразование в тензор и перестановка осей (HWC → CHW)
        data_lowlight = torch.from_numpy(data_lowlight).float()
        data_lowlight = data_lowlight.permute(2, 0, 1).unsqueeze(0).cuda()  # [1, 3, H, W]

        # Загрузка модели
        DCE_net = preproc_nm.ZeroDCE.model.enhance_net_nopool().cuda()
        DCE_net.load_state_dict(torch.load('preproc_nm/ZeroDCE/snapshots/Epoch99.pth'))

        # Прогон изображения через модель
        _, enhanced_image, _ = DCE_net(data_lowlight)

        # Преобразуем тензор в NumPy-массив
        enhanced_image = enhanced_image.squeeze(0)         # [3, H, W]
        enhanced_image = enhanced_image.permute(1, 2, 0)    # [H, W, 3]
        enhanced_image = enhanced_image.detach().cpu().numpy()
        enhanced_image = (enhanced_image * 255.0).clip(0, 255).astype(np.uint8)

        # Перевод обратно в BGR
        enhanced_image_bgr = cv2.cvtColor(enhanced_image, cv2.COLOR_RGB2BGR)
        return enhanced_image_bgr, final_params
        '''
        global zero_dce_processor
        enhanced_image_bgr = zero_dce_processor.enhance_image(frame)
        return enhanced_image_bgr, {}
    # *****************************
    # Denoising Methods
    # *****************************
    elif preproc_method == "median":
        # Применение медианного фильтра
        ksize = int(params.get('k', 5))
        final_params = {"k" : ksize}
        # Убедимся, что ksize нечетный и >=3
        if ksize < 3:
            ksize = 3
        if ksize % 2 == 0:
            ksize += 1
        return cv2.medianBlur(frame, ksize=ksize), final_params
    elif preproc_method == "bilateral":
        # Применение билатерального фильтра
        d = int(params.get('d', 9))
        sigma_color = float(params.get('sigmaColor', 75))
        sigma_space = float(params.get('sigmaSpace', 75))
        final_params = {"d" : d, "sigmaColor" : sigma_color, "sigmaSpace" : sigma_space}
        return cv2.bilateralFilter(frame, d=d, sigmaColor=sigma_color, sigmaSpace=sigma_space), final_params
    elif preproc_method == "gaussian":
        # Применение Гауссовского фильтра
        ksize = params.get("ksize", "5x5")
        sigma = float(params.get("sigma", 0))
        final_params = {"ksize" : ksize, "sigma" : sigma}
        try:
            kx, ky = map(int, ksize.lower().split('x'))
        except Exception:
            kx, ky = 5, 5  
        return cv2.GaussianBlur(frame, (kx, ky), sigma), final_params
    elif preproc_method == "nl_means":
        h = int(params.get('h', 10))
        templateWindowSize = int(params.get('templateWindowSize', 7))
        searchWindowSize = int(params.get('searchWindowSize', 21))
        isColor = int(params.get('isColor', 0)) == 1
        hColor = int(params.get('hColor', 10)) if isColor else None

        final_params = {"h" : h, "templateWindowSize" : templateWindowSize, "searchWindowSize" : searchWindowSize, "isColor" : isColor }

        if isColor:
            final_params['hColor'] = hColor
            return cv2.fastNlMeansDenoisingColored(frame, None, h, hColor, templateWindowSize, searchWindowSize), final_params
        else:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            denoised = cv2.fastNlMeansDenoising(gray, None, h, templateWindowSize, searchWindowSize)
            denoised_bgr = cv2.cvtColor(denoised, cv2.COLOR_GRAY2BGR)
            return denoised_bgr, final_params
    # *****************************

    # *****************************
    # Morphological Operations
    # *****************************
    elif preproc_method == "morphology":
        op = params.get("op", "open").lower()
        ksize = int(params.get("ksize", 3))
        iterations = int(params.get("iterations", 1))
        final_params = {"op": op, "ksize": ksize, "iterations": iterations}

        # Убедимся, что ядро имеет нечётный размер и минимум 1
        if ksize < 1:
            ksize = 1
        if ksize % 2 == 0:
            ksize += 1

        # Создание ядра
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (ksize, ksize))

        # Перевод в градации серого
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        if op == "erode":
            processed = cv2.erode(gray, kernel, iterations=iterations)
        elif op == "dilate":
            processed = cv2.dilate(gray, kernel, iterations=iterations)
        elif op == "open":
            processed = cv2.morphologyEx(gray, cv2.MORPH_OPEN, kernel, iterations=iterations)
        elif op == "close":
            processed = cv2.morphologyEx(gray, cv2.MORPH_CLOSE, kernel, iterations=iterations)
        elif op == "gradient":
            processed = cv2.morphologyEx(gray, cv2.MORPH_GRADIENT, kernel, iterations=iterations)
        elif op == "tophat":
            processed = cv2.morphologyEx(gray, cv2.MORPH_TOPHAT, kernel, iterations=iterations)
        elif op == "blackhat":
            processed = cv2.morphologyEx(gray, cv2.MORPH_BLACKHAT, kernel, iterations=iterations)
        else:
            raise ValueError(f"Unsupported morphological op: {op}")

        processed_bgr = cv2.cvtColor(processed, cv2.COLOR_GRAY2BGR)
        return processed_bgr, final_params
    elif preproc_method == "dcp":
        window_size = int(params.get('window_size', 15))
        omega = float(params.get('omega', 0.95))
        t0 = float(params.get('t0', 0.1))
        atmospheric_light_top_percent = float(params.get('atmospheric_light_top_percent', 0.1)) / 100

        final_params = {
            "window_size": window_size,
            "omega": omega,
            "t0": t0,
            "atmospheric_light_top_percent": atmospheric_light_top_percent
        }
        
        # Проверяем, что изображение цветное, так как DCP работает с 3 каналами
        if len(frame.shape) < 3 or frame.shape[2] != 3:
            # Если изображение не цветное, конвертируем его
            # Или возвращаем оригинальное изображение / поднимаем ошибку, в зависимости от логики
            # Здесь я конвертирую в BGR, если оно в оттенках серого
            if len(frame.shape) == 2:
                frame_color = cv2.cvtColor(frame, cv2.COLOR_GRAY2RGB)
            else:
                raise ValueError("DCP method requires a 3-channel (color) image.")
        else:
            frame_color = frame

        dehazed_frame = dehaze(frame_color, window_size, omega, t0, atmospheric_light_top_percent)
        return dehazed_frame, final_params
    # *****************************
    # SPECIAL: DEHAZE & DEPTH
    # *****************************
    elif preproc_method == "dcp":
        ws = int(params.get('window_size', 15))
        om = float(params.get('omega', 0.95))
        t0 = float(params.get('t0', 0.1))
        # Проверка на цветное изображение
        if len(frame.shape) < 3: frame = cv2.cvtColor(frame, cv2.COLOR_GRAY2BGR)
        
        res = dehaze(frame, ws, om, t0)
        return res, {"window_size": ws, "omega": om}
    # Делегируем вызовы глубины в модуль depth.py
    elif preproc_method == "depth_dcp":
        if not depth.depth_models_initialized:
            depth.init_depth_models()
        return depth.apply_depth_dcp(frame, **params)      
    elif preproc_method == "depth_midas":
        if not depth.depth_models_initialized:
            depth.init_depth_models()
        return depth.apply_depth_midas(frame, **params)
    else:
        raise ValueError(f"Unsupported preprocessing method: {preproc_method}")


