from detectors.object_detector import ObjectDetector, COCO_CLASSES
import torchvision.transforms as transforms
import torch, cv2, time

class DetrDetector(ObjectDetector):
    """
    DETR detector class (derived from ObjectDetector)
    """ 
    def __init__(self):
        self.model = torch.hub.load('facebookresearch/detr', 'detr_resnet50', pretrained=True)
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        self.model.eval()
        self.model.to(self.device)
        self.classes = COCO_CLASSES  # Получаем названия классов из COCO

    def detect(self, image):
        """
        Detect objects in the given image using DETR.

        Args:
            image: The input image in which to detect objects.

        Returns:
            A list of detected objects.
        """
        # Преобразование BGR → RGB
        img_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

        # Трансформы для DETR
        transform = transforms.Compose([
            transforms.ToTensor(),  # Конвертирует RGB-numpy в тензор + меняет HWC → CHW
            transforms.Normalize(
            mean=[0.485, 0.456, 0.406],  # ImageNet mean (для RGB!)
            std=[0.229, 0.224, 0.225]    # ImageNet std (для RGB!)
        )])

        # Применяем трансформы
        img_tensor = transform(img_rgb)  # [3, H, W], float32, диапазон ~[-2, 2]
        img_tensor = img_tensor.unsqueeze(0)  # [1, 3, H, W] (добавляем батч)
        img_tensor = img_tensor.to(self.device)   

        start_time = time.time()
        with torch.no_grad():
            results = self.model(img_tensor)
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
        # Обработка результатов DETR
        logits = results['pred_logits'][0]  # [N, num_classes]
        boxes = results['pred_boxes'][0]  # [N, 4] в формате (cx, cy, w, h), нормализованные [0, 1]

        scores = logits.softmax(-1)[:, :-1]  # Удаляем фон (последний класс)
        max_scores, labels = scores.max(-1)   # Берем максимальный score и его класс

        annotations = []
        classes = set()

        for score, label, box in zip(max_scores, labels, boxes):
            if score <= 0.5:
                continue
            
            cx, cy, w, h = box
            class_name = self.classes[label] 

            annotations.append(f"{class_name} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f} {score:.6f}")
            classes.add(class_name)

        return annotations, list(classes)