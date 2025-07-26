# Copyright (C) 2025, Serdechny Vitaly
# This file is part of PROMIN AI Research Tool

# Constants & Globals Available in all Modules
# --------------------------------------------
from detectors.yolo_detector import YoloDetector
from detectors.fasterrcnn_detector import FasterRcnnDetector
from detectors.maskrcnn_detector import MaskRcnnDetector
from detectors.detr_detector import DetrDetector
from detectors.ssd_detector import SsdDetector
from detectors.retinanet_detector import RetinaNetDetector

UPLOADS_DIR = 'uploads'
FRAMES_DIR = 'frames'
OBJECT_DETECTIONS_DIR = 'object-detections'
ANALYSIS_DIR = 'analysis'

DETECTOR_CONFIG = {
    'yolo': lambda model: YoloDetector(*model.split('_')[1:]),
    'faster': lambda model: FasterRcnnDetector(),
    'mask': lambda model: MaskRcnnDetector(),
    'ssd': lambda model: SsdDetector(),
    'detr': lambda model: DetrDetector(),
    'retina': lambda model: RetinaNetDetector(),
}