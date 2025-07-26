from abc import ABC, abstractmethod

# Классы COCO
COCO_CLASSES = [
    "_no_objects_", "person", "bicycle", "car", "motorbike", "aeroplane", "bus", "train", "truck",
    "boat", "trafficlight", "firehydrant", "streetsign", "stopsign", "parkingmeter",
    "bench", "bird", "cat", "dog", "horse", "sheep", "cow", "elephant", "bear",
    "zebra", "giraffe", "hat", "backpack", "umbrella", "shoe", "eyeglasses", "handbag",
    "tie", "suitcase", "frisbee", "skis", "snowboard", "sportsball", "kite",
    "baseballbat", "baseballglove", "skateboard", "surfboard", "tennisracket", "bottle",
    "plate", "wineglass", "cup", "fork", "knife", "spoon", "bowl", "banana", "apple",
    "sandwich", "orange", "broccoli", "carrot", "hotdog", "pizza", "donut", "cake",
    "chair", "sofa", "pottedplant", "bed", "mirror", "diningtable", "window", "desk",
    "toilet", "door", "tvmonitor", "laptop", "mouse", "remote", "keyboard", "cellphone",
    "microwave", "oven", "toaster", "sink", "refrigerator", "blender", "book", "clock",
    "vase", "scissors", "teddybear", "hairdrier", "toothbrush", "hairbrush"
]

class ObjectDetector(ABC):
    """
    Abstract base class for object detectors.
    """

    @abstractmethod
    def detect(self, image):
        """
        Detect objects in the given image.

        Args:
            image: The input image in which to detect objects.

        Returns:
            A list of detected objects.
        """
        pass

    @abstractmethod
    def results_to_yolov8_f(self, results, image):
        """
        Convert objects detection results to YOLOv8 format.

        Args:
            results: The results from the object detection model.
            image: The input image.

        Returns:
            Annotations in YOLOv8 format and a list of unique classes.
        """
        pass