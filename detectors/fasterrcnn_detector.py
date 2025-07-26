from detectors.object_detector import ObjectDetector
from torchvision.models.detection import fasterrcnn_resnet50_fpn, FasterRCNN_ResNet50_FPN_Weights
import torch, cv2, time
from PIL import Image

class FasterRcnnDetector(ObjectDetector):
    """
    FasterRCNN detector class (derived from ObjectDetector)
    """ 
    def __init__(self):
        # Initializing Faster R-CNN model
        self.weights = FasterRCNN_ResNet50_FPN_Weights.DEFAULT
        self.model = fasterrcnn_resnet50_fpn(weights=self.weights, box_score_thresh=0.5)
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        self.model.eval()
        self.model.to(self.device)
        self.classes = self.weights.meta['categories']  # Получаем названия классов из весов

    def detect(self, image):
        """
        Detect objects in the given image using Faster R-CNN.

        Args:
            image: The input image in which to detect objects.

        Returns:
            A list of detected objects.
        """
        # Преобразование BGR → RGB
        img_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

        # 🔥 Конвертируем в PIL Image
        img_pil = Image.fromarray(img_rgb)

        # Трансформы
        transform = self.weights.transforms()
        # Применяем трансформы
        img_tensor = transform(img_pil).unsqueeze(0).to(self.device)

        start_time = time.time()
        with torch.no_grad():
            results = self.model(img_tensor)
        end_time = time.time()

        return results[0], end_time - start_time
    
    def results_to_yolov8_f(self, results, image):
        """
        Convert objects detection results to YOLOv8 format.

        Args:
            results: The results from the YOLOv8 model.

        Returns:
            Annotations in YOLOv8 format and a list of unique classes.
        """
        annotations = []
        classes = set()

        boxes = results['boxes'].cpu().numpy()
        labels = results['labels'].cpu().numpy()
        scores = results['scores'].cpu().numpy()

        height_img, width_img = image.shape[:2]

        for box, label, score in zip(boxes, labels, scores):   
            x1, y1, x2, y2 = box

            x_center = ((x1 + x2) / 2) / width_img
            y_center = ((y1 + y2) / 2) / height_img
            width = (x2 - x1) / width_img 
            height = (y2 - y1) / height_img 

            class_name = self.classes[label]
            annotations.append(f"{class_name} {x_center:.6f} {y_center:.6f} {width:.6f} {height:.6f} {score:.6f}")
            classes.add(class_name)
        
        return annotations, list(classes)
    
    