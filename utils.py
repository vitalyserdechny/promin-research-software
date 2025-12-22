import cv2, os, random, glob, logging, json
from preproc import apply_preproc
import numpy as np
from detectors.yolo_detector import YoloDetector
from config import *

def generate_unique_colors(n):
    """Генерирует n уникальных цветов в формате BGR."""
    colors = []
    while len(colors) < n:
        color = (random.randint(0, 255), random.randint(0, 255), random.randint(0, 255))
        if color not in colors:
            colors.append(color)
    return colors

def parse_frames(cap, total_frames, frames_path, socketio):
    '''
    Frames are extracted from the video located at {video_path}
    and saved to a folder at {output_dir_path} (the folder will be created if it does not exist).
    \nThe function does not perform any object detection, it simply extracts frames.
    '''
    frame_count = 0
    
    logging.info('Extracting frames from the video...')
    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame_file = os.path.join(frames_path, f'frame_{frame_count:06d}.jpg')
        cv2.imwrite(frame_file, frame)
        frame_count += 1
        logging.info(f'Frame [{frame_count}] has been saved to the file {frame_file}')

        # Отправка прогресса через сокет
        progress = (frame_count / total_frames) * 100
        socketio.emit('video-processing-progress', {'progress': progress, 'frame' : frame_count, 'total_frames' : total_frames, 'sid': 'video-processing-progress'})

    logging.info('**********************************************')
    logging.info(f"Successfully saved {frame_count} frames in the folder {frames_path}.")

def parse_frames_with_yolo(cap, total_frames, project_file_path, frames_path, object_detections_path, socketio):
    '''
    Frames are extracted from the video located at {video_path}
    and saved to a folder at {output_dir_path} (the folder will be created if it does not exist).
    \nThe function also performs object detection on each frame using YOLO and saves the results.
    '''
    all_classes = set()
    yolo_detector = YoloDetector('11', 's')
    frame_count = 0
    
    logging.info('Extracting frames from the video...')
    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame_file = os.path.join(frames_path, f'frame_{frame_count:06d}.jpg')
        cv2.imwrite(frame_file, frame)
        frame_count += 1
        logging.info(f'Frame [{frame_count}] has been saved to the file {frame_file}')

        annotate_frame(frame_file, yolo_detector, object_detections_path, all_classes)

        # Отправка прогресса через сокет
        progress = (frame_count / total_frames) * 100
        socketio.emit('video-processing-progress', {'progress': progress, 'frame' : frame_count, 'total_frames' : total_frames, 'sid': 'video-processing-progress'})

    colors = generate_unique_colors(len(all_classes))
    unique_classes = list(set(all_classes))
    class_colors = dict(zip(unique_classes, colors))

    try:
        with open(project_file_path, 'r', encoding='utf-8') as f:
            project_info = json.load(f)
    except Exception as e:
        logging.error(f'Failed to load project file {project_file_path}: {e}')
        return
    
    project_info.pop('classes', None)
    project_info['classes'] = {class_name: color for class_name, color in class_colors.items()}

    try:
        with open(project_file_path, 'w', encoding='utf-8') as f:
            json.dump(project_info, f, indent=4)
        logging.info(f'Classes and colors successfully saved to {project_file_path}')
    except Exception as e:
        logging.error(f'Failed to save updated project file {project_file_path}: {e}')
        return

    logging.info('**********************************************')
    logging.info(f"Successfully saved {frame_count} frames in the folder {frames_path}.")

def video_to_frames(project_dir, is_annontation_required, socketio):
    '''
    The function extracts frames from the video located at {video_path}
    and saves them to a folder at {output_dir_path} (the folder will be created if it does not exist)
    '''
    video_path = os.path.join(project_dir, 'video.mp4')
    frames_path = os.path.join(project_dir, FRAMES_DIR)
    object_detections_path = os.path.join(project_dir, OBJECT_DETECTIONS_DIR)
    project_file_path = os.path.join(project_dir, 'project.json')

    cap = cv2.VideoCapture(video_path)

    if not cap.isOpened():
        logging.error(f"Error opening video file!")
        return

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    if is_annontation_required:
        parse_frames_with_yolo(cap, total_frames, project_file_path, frames_path, object_detections_path, socketio)
    else:
        parse_frames(cap, total_frames, frames_path, socketio)
    
def annotate_frame_in_playground(frame, detector):
    results, pr_time = detector.detect(frame)
    annotations, _ = detector.results_to_yolov8_f(results, frame)
    return annotations, pr_time 

def annotate_frame(frame, detector, output_annotations_dir, all_classes, preproc_pipeline = None):
    logging.info(f"Annotating frame {frame} with {detector.__class__.__name__}")
    img = cv2.imread(frame)
    if img is None:
        logging.error(f"Unable to read frame {frame}, skipping.")
        return
    
    if preproc_pipeline:
        for step in preproc_pipeline:
            if not isinstance(step, dict):
                logging.warning(f"Invalid preprocessing step format: {step}")
                continue
            method = step.get("method")
            params = step.get("params", {})
            if not method:
                logging.warning(f"Missing 'method' in preprocessing step: {step}")
                continue
            try:
                logging.info(f"Applying preprocessing step: {method} with params: {params}")
                img, _ = apply_preproc(img, method, **params)
            except Exception as e:
                logging.error(f"Error applying preprocessing step '{method}': {e}")
                continue
    
    results, pr_time = detector.detect(img)

    annotations, classes = detector.results_to_yolov8_f(results, img)
    if all_classes:
        all_classes.update(classes) 

    frame_name = os.path.basename(frame)
    annotation_file = os.path.join(output_annotations_dir, frame_name.replace('.jpg', '.txt'))
    with open(annotation_file, "w") as f:
        f.write("\n".join(annotations))

    logging.info(f"Annotations for frame {frame} saved to {annotation_file}.")
    return pr_time

def calculate_iou(box1, box2):
    """Вычисляет IoU (Intersection over Union) для двух ограничивающих рамок.
    Ожидает формат box: (x_min, y_min, x_max, y_max).
    """
    x1_min, y1_min, x1_max, y1_max = box1
    x2_min, y2_min, x2_max, y2_max = box2

    # Вычисление координат пересечения
    intersection_x_min = max(x1_min, x2_min)
    intersection_y_min = max(y1_min, y2_min)
    intersection_x_max = min(x1_max, x2_max)
    intersection_y_max = min(y1_max, y2_max)

    # Вычисление площади пересечения
    # Если нет пересечения, max(0, ...) гарантирует, что площадь будет 0
    intersection_width = max(0, intersection_x_max - intersection_x_min)
    intersection_height = max(0, intersection_y_max - intersection_y_min)
    intersection_area = intersection_width * intersection_height

    # Вычисление площадей обоих ограничивающих рамок
    box1_area = (x1_max - x1_min) * (y1_max - y1_min)
    box2_area = (x2_max - x2_min) * (y2_max - y2_min)

    # Вычисление площади объединения
    union_area = box1_area + box2_area - intersection_area

    # Возврат IoU, избегая деления на ноль
    return intersection_area / union_area if union_area > 0 else 0

def parse_annotation(line):
    """Разбирает строку аннотации в формате YOLO.
    Исправлена ошибка потери класса при стандартном формате из 5 чисел.
    """
    parts = line.strip().split()
    if not parts:
        return None

    # Минимально допустимая длина - 5 (класс + 4 координаты)
    if len(parts) < 5:
        print(f"Предупреждение: Недостаточно данных в строке: '{line}'. Пропускаю.")
        return None

    try:
        class_label = None
        x_center, y_center, width, height = 0.0, 0.0, 0.0, 0.0
        confidence = 1.0 # Дефолтное значение для GT

        # Сценарий 1: Есть Confidence (обычно 6+ элементов или 5, если класс не число, но это редкость для YOLO)
        # Проверяем, являются ли последние 5 элементов числами (x, y, w, h, conf)
        # ВАЖНО: Мы должны убедиться, что перед ними есть хотя бы 1 элемент для класса!
        if len(parts) >= 6 and all(is_float(p) for p in parts[-5:]):
            numeric_values = list(map(float, parts[-5:]))
            class_label = ' '.join(parts[:-5]) # Всё, что перед числами - класс
            x_center, y_center, width, height, confidence = numeric_values

        # Сценарий 2: Нет Confidence (Стандартный GT: Класс + 4 координаты)
        # Проверяем последние 4 элемента
        elif len(parts) >= 5 and all(is_float(p) for p in parts[-4:]):
            numeric_values = list(map(float, parts[-4:]))
            class_label = ' '.join(parts[:-4]) # Всё, что перед координатами - класс
            x_center, y_center, width, height = numeric_values
            confidence = 1.0
        
        else:
            print(f"Предупреждение: Не удалось разобрать формат строки: '{line}'.")
            return None

        # Финальная проверка метки
        if not class_label:
            # Это может случиться, если строка была типа "0.5 0.5 0.2 0.2 0.9" без класса вообще
            print(f"Предупреждение: Отсутствует метка класса в строке: '{line}'.")
            return None

        return class_label, x_center, y_center, width, height, confidence

    except ValueError as e:
        print(f"Ошибка данных при разборе '{line}': {e}")
        return None

def is_float(value):
    """Вспомогательная функция для проверки, является ли строка числом с плавающей точкой."""
    try:
        float(value)
        return True
    except ValueError:
        return False

def calculate_metrics(annotations_folder, predicted_folder):
    """Вычисляет mAP@[.5:.95], mAP@0.5, Precision, Recall, F1-score и IoU.
    Обрабатывает файлы, сопоставляя их по базовому имени.
    """
    annotation_files_map = {os.path.basename(f): f for f in glob.glob(os.path.join(annotations_folder, '*.txt'))}
    predicted_files_map = {os.path.basename(f): f for f in glob.glob(os.path.join(predicted_folder, '*.txt'))}

    # Ищем общие файлы между аннотациями и предсказаниями
    common_files = sorted(list(set(annotation_files_map.keys()) & set(predicted_files_map.keys())))

    if not common_files:
        print(f"Не найдено общих файлов для обработки в '{annotations_folder}' и '{predicted_folder}'.")
        return {
            'mAP@0.5': 0.0,
            'mAP@.5:.95': 0.0,
            'Precision (Global@0.5)': 0.0,
            'Recall (Global@0.5)': 0.0,
            'F1-score (Global@0.5)': 0.0,
            'IoU (of True Positives@0.5)': 0.0
        }

    all_detections_by_frame = []
    all_annotations_by_frame = []

    print(f"Обработка {len(common_files)} общих файлов...")

    for filename in common_files:
        annotation_file_path = annotation_files_map[filename]
        predicted_file_path = predicted_files_map[filename]

        with open(annotation_file_path, 'r') as f:
            annotations = [parse_annotation(line) for line in f if line.strip()]
            annotations = [ann for ann in annotations if ann is not None] # Отфильтровываем None
        with open(predicted_file_path, 'r') as f:
            predictions = [parse_annotation(line) for line in f if line.strip()]
            predictions = [pred for pred in predictions if pred is not None] # Отфильтровываем None

        all_annotations_by_frame.append(annotations)
        all_detections_by_frame.append(predictions)

    # Собираем все уникальные классы
    all_classes = set()
    for frame_annotations in all_annotations_by_frame:
        for class_label, *_ in frame_annotations:
            all_classes.add(class_label)
    for frame_predictions in all_detections_by_frame:
        for class_label, *_ in frame_predictions:
            all_classes.add(class_label)
    all_classes = sorted(list(all_classes))

    if not all_classes:
        print("Не найдено ни одного класса в аннотациях или предсказаниях.")
        return {
            'mAP@0.5': 0.0,
            'mAP@.5:.95': 0.0,
            'Precision (Global@0.5)': 0.0,
            'Recall (Global@0.5)': 0.0,
            'F1-score (Global@0.5)': 0.0,
            'IoU (of True Positives@0.5)': 0.0
        }


    iou_thresholds = np.arange(0.5, 1.0, 0.05) # [0.5, 0.55, ..., 0.95]
    ap_scores_per_iou = {iou: [] for iou in iou_thresholds}

    # Глобальные метрики (Precision, Recall, F1) вычисляются при IoU@0.5
    global_true_positives_at_0_5 = 0
    global_false_positives_at_0_5 = 0
    global_false_negatives_at_0_5 = 0
    all_iou_scores_for_tp_at_0_5 = []

    for iou_thresh in iou_thresholds:
        # Для каждого порога IoU мы пересчитываем TP/FP для каждого класса
        class_wise_detections = {cls: [] for cls in all_classes}
        class_wise_annotations = {cls: [] for cls in all_classes}

        # Распределение аннотаций и детекций по классам и кадрам
        for frame_idx, (frame_anns, frame_preds) in enumerate(zip(all_annotations_by_frame, all_detections_by_frame)):
            for ann_idx, ann in enumerate(frame_anns):
                class_label, x_c, y_c, w, h, _ = ann
                # Преобразование из YOLO-формата (центр, ширина, высота) в (x_min, y_min, x_max, y_max)
                bbox_ann = (x_c - w / 2, y_c - h / 2, x_c + w / 2, y_c + h / 2)
                class_wise_annotations[class_label].append((bbox_ann, frame_idx, ann_idx))

            for pred in frame_preds:
                class_label, x_c, y_c, w, h, confidence = pred
                bbox_pred = (x_c - w / 2, y_c - h / 2, x_c + w / 2, y_c + h / 2)
                class_wise_detections[class_label].append((confidence, bbox_pred, frame_idx))

        ap_scores_current_iou = []

        for class_label in all_classes:
            detections = class_wise_detections[class_label]
            annotations = class_wise_annotations[class_label]
            
            # Сортировка детекций по убыванию уверенности
            detections.sort(key=lambda x: x[0], reverse=True)

            tp_list = [] # Список для истинных срабатываний (1) или ложных срабатываний (0)
            fp_list = [] # Список для ложных срабатываний (1) или истинных срабатываний (0)
            
            # Отслеживаем, какие аннотации уже были сопоставлены для текущего порога IoU
            matched_annotations_for_class = set() 

            for det_confidence, det_bbox, det_frame_idx in detections:
                best_iou = 0.0
                matched_annotation_key = None # (frame_idx, ann_idx)

                # Ищем наиболее подходящую аннотацию для текущей детекции в том же кадре
                relevant_annotations = [
                    (bbox, ann_idx) for bbox, frame_idx, ann_idx in annotations if frame_idx == det_frame_idx
                ]

                for ann_bbox, ann_idx in relevant_annotations:
                    # Проверяем, что эта аннотация еще не была сопоставлена для текущего порога IoU
                    if (det_frame_idx, ann_idx) in matched_annotations_for_class:
                        continue
                    
                    iou = calculate_iou(det_bbox, ann_bbox)
                    if iou > best_iou:
                        best_iou = iou
                        matched_annotation_key = (det_frame_idx, ann_idx)

                if best_iou >= iou_thresh:
                    tp_list.append(1)
                    fp_list.append(0)
                    if matched_annotation_key: # Добавляем аннотацию в набор сопоставленных
                        matched_annotations_for_class.add(matched_annotation_key)
                    
                    # Сохраняем IoU для истинных срабатываний при IoU@0.5
                    if iou_thresh == 0.5:
                        all_iou_scores_for_tp_at_0_5.append(best_iou)
                else:
                    tp_list.append(0)
                    fp_list.append(1)
            
            # Вычисление кумулятивных TP и FP
            cumulative_tp = np.cumsum(tp_list)
            cumulative_fp = np.cumsum(fp_list)
            
            # Общее количество истинных объектов для данного класса
            num_gt = len(annotations)

            # Вычисление Precision и Recall
            if len(detections) == 0:
                precision = np.array([0.0])
                recall = np.array([0.0])
            else:
                precision = cumulative_tp / (cumulative_tp + cumulative_fp + 1e-10)
                recall = cumulative_tp / (num_gt + 1e-10)
            
            # Добавление начальных и конечных точек для PR-кривой для правильной интерполяции
            # (0, 1) - если recall 0, precision должна быть 1 (идеально)
            # (max_recall, 0) - чтобы кривая опустилась до нуля после последнего recall
            all_recall = np.concatenate(([0.0], recall, [recall[-1] + 1e-10 if len(recall) > 0 else 1.0]))
            all_precision = np.concatenate(([1.0], precision, [0.0]))

            # Интерполяция (интерполяция по всем точкам):
            # Precision должна быть невозрастающей функцией recall
            for i in range(len(all_precision) - 2, -1, -1):
                all_precision[i] = np.maximum(all_precision[i], all_precision[i+1])

            # Вычисление AP как площади под PR-кривой (метод трапеций)
            ap = np.sum((all_recall[1:] - all_recall[:-1]) * all_precision[1:])
            
            ap_scores_current_iou.append(ap)

            # Обновление глобальных TP/FP/FN для IoU@0.5
            if iou_thresh == 0.5:
                global_true_positives_at_0_5 += cumulative_tp[-1] if len(cumulative_tp) > 0 else 0
                global_false_positives_at_0_5 += cumulative_fp[-1] if len(cumulative_fp) > 0 else 0
                global_false_negatives_at_0_5 += (num_gt - (cumulative_tp[-1] if len(cumulative_tp) > 0 else 0))

        # Вычисление среднего AP для текущего порога IoU по всем классам
        ap_scores_per_iou[iou_thresh] = np.mean(ap_scores_current_iou) if ap_scores_current_iou else 0.0

    # Вычисление mAP@.5:.95
    mean_ap_50_95 = np.mean(list(ap_scores_per_iou.values())) if ap_scores_per_iou else 0.0
    # Вычисление mAP@0.5
    mean_ap_0_5 = ap_scores_per_iou.get(0.5, 0.0)

    # Вычисление глобальных Precision, Recall, F1-score при IoU@0.5
    total_detections_at_0_5 = global_true_positives_at_0_5 + global_false_positives_at_0_5
    total_ground_truths_at_0_5 = global_true_positives_at_0_5 + global_false_negatives_at_0_5

    global_precision_at_0_5 = global_true_positives_at_0_5 / (total_detections_at_0_5 + 1e-10)
    global_recall_at_0_5 = global_true_positives_at_0_5 / (total_ground_truths_at_0_5 + 1e-10)
    global_f1_at_0_5 = 2 * global_precision_at_0_5 * global_recall_at_0_5 / (global_precision_at_0_5 + global_recall_at_0_5 + 1e-10)
    
    # Средний IoU для истинных срабатываний при IoU@0.5
    mean_iou_tp_at_0_5 = np.mean(all_iou_scores_for_tp_at_0_5) if all_iou_scores_for_tp_at_0_5 else 0.0

    return {
        'mAP@0.5': mean_ap_0_5,
        'mAP@.5:.95': mean_ap_50_95,
        'Precision (Global@0.5)': global_precision_at_0_5,
        'Recall (Global@0.5)': global_recall_at_0_5,
        'F1-score (Global@0.5)': global_f1_at_0_5,
        'IoU (of True Positives@0.5)': mean_iou_tp_at_0_5
    }
