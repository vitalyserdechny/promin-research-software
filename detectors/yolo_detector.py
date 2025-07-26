from detectors.object_detector import ObjectDetector
from ultralytics import YOLO
import time

class YoloDetector(ObjectDetector):
    """
    YOLO detector class (derived from ObjectDetector)
    """ 
    def __init__(self, model_version = '11', model_size = 'x'):
        self.model_version = model_version
        self.model_size = model_size
        if model_version == '11':
            self.model = YOLO(f'yolo{model_version}{model_size}.pt')
        else:
            self.model = YOLO(f'yolov{model_version}{model_size}.pt')
        self.classes = self.model.names  # Получаем названия классов из модели

    def detect(self, image):
        """
        Detect objects in the given image using YOLOv8.

        Args:
            image: The input image in which to detect objects.

        Returns:
            A list of detected objects.
        """
        start_time = time.time()
        results = self.model(image)
        end_time = time.time()

        return results, end_time - start_time
    
    def results_to_yolov8_f(self, results, image):
        """
        Convert objects detection results to YOLOv8 format.

        Args:
            results: The results from the YOLOv8 model.

        Returns:
            Annotations in YOLOv8 format and a list of unique classes.
        """
        annotations = []
        classes = []

        for result in results:
            if result.boxes is None:
                continue

            boxes = result.boxes.xywh.cpu().numpy()  # Формат координат xywh (центр и размеры рамки)
            confidences = result.boxes.conf.cpu().numpy()  # Уверенность модели
            class_ids = result.boxes.cls.cpu().numpy().astype(int)  # ID классов

            for box, confidence, class_id in zip(boxes, confidences, class_ids):
                x_center, y_center, width, height = box
                height_img, width_img = image.shape[:2]  # Получаем размеры изображения
                x_center /= width_img
                y_center /= height_img
                width /= width_img
                height /= height_img
                
                class_name = self.classes[class_id]
                annotations.append(f"{class_name} {x_center:.6f} {y_center:.6f} {width:.6f} {height:.6f} {confidence:.6f}")
                classes.append(class_name)

        return annotations, list(set(classes))