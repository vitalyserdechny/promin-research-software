import logging
import math
import os, json, glob
import re
import urllib
from config import UPLOADS_DIR, FRAMES_DIR, OBJECT_DETECTIONS_DIR, ANALYSIS_DIR

class ProjectManager:
    def __init__(self, root_dir):
        self.root_dir = root_dir

    def get_project_path(self, project_folder_name):
        return os.path.join(self.root_dir, project_folder_name)
    
    def load_metadata(self, project_folder_name):
        """Читает project.json и возвращает dict, или дефолтные значения"""
        path = os.path.join(self.get_project_path(project_folder_name), 'project.json')
        if not os.path.exists(path):
            return None
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading project {project_folder_name}: {e}")
            return None
        
    def get_all_projects(self):
        projects = []
        if not os.path.exists(self.root_dir):
            return []
            
        for folder_name in os.listdir(self.root_dir):
            folder_path = os.path.join(self.root_dir, folder_name)
            if not os.path.isdir(folder_path):
                continue

            data = self.load_metadata(folder_name)
            if data:
                projects.append({
                    'folder': folder_name,
                    'name': data.get('project_name', 'Unnamed'),
                    'created_at': data.get('created_at')
                })
        # Сортировка
        projects.sort(key=lambda x: x['created_at'] or '', reverse=True)
        return projects
    
    def get_frames_paginated(self, project_folder_name, page=1, per_page=50):
        """
        Возвращает порцию кадров и метаданные пагинации.
        """
        project_path = self.get_project_path(project_folder_name)
        frames_dir = os.path.join(project_path, FRAMES_DIR)
        annotations_dir = os.path.join(project_path, OBJECT_DETECTIONS_DIR)

        if not os.path.exists(frames_dir):
            return {
                'frames': [],
                'total_frames': 0,
                'total_pages': 0,
                'current_page': page
            }

        all_frames = sorted(glob.glob(os.path.join(frames_dir, '*.jpg')))
        total_frames = len(all_frames)
        
        start = (page - 1) * per_page
        end = start + per_page
        
        frames_slice = all_frames[start:end]
        frames_data = []

        for i, frame_path in enumerate(frames_slice):
            global_frame_index = start + i 
            
            frame_name = os.path.basename(frame_path)
            annotation_path = os.path.join(annotations_dir, frame_name.replace('.jpg', '.txt'))
            
            # Используем общий метод парсинга
            annotations = self._parse_annotation_file(annotation_path)

            rel_path = os.path.relpath(frame_path, UPLOADS_DIR)
            frame_url = '/uploads/' + urllib.parse.quote(rel_path.replace(os.sep, "/"))

            frames_data.append({
                'frame_index': global_frame_index,
                'name': frame_name,
                'url': frame_url,
                'annotations': annotations
            })

        return {
            'frames': frames_data,
            'pagination': {
                'total_frames': total_frames,
                'total_pages': math.ceil(total_frames / per_page),
                'current_page': page,
                'per_page': per_page,
                'has_next': end < total_frames
            }
        }

    def save_annotations(self, project_folder_name, frames_data):
        """
        Сохраняет аннотации в TXT файлы YOLO формата.
        frames_data: список объектов {frame_index, annotations}
        """
        project_path = self.get_project_path(project_folder_name)
        annotations_dir = os.path.join(project_path, OBJECT_DETECTIONS_DIR)
        
        if not os.path.exists(annotations_dir):
            os.makedirs(annotations_dir)

        for frame_item in frames_data:
            frame_index = frame_item.get('frame_index')
            annotations = frame_item.get('annotations', [])
            
            file_name = f'frame_{frame_index:06d}.txt'
            file_path = os.path.join(annotations_dir, file_name)
            
            with open(file_path, 'w', encoding='utf-8') as f:
                for ann in annotations:
                    # YOLO format: class x y w h conf
                    label = ann.get('label', 'unknown')
                    x = ann.get('x', 0)
                    y = ann.get('y', 0)
                    w = ann.get('width', 0)
                    h = ann.get('height', 0)
                    c = ann.get('confidence', 1.0)
                    
                    line = f"{label} {x} {y} {w} {h} {c}\n"
                    f.write(line)
    # =========================================================================

    def get_frame_annotations(self, project_folder_name, frame_index):
        """Получает только Ground Truth для конкретного кадра"""
        project_path = self.get_project_path(project_folder_name)
        ann_path = os.path.join(project_path, OBJECT_DETECTIONS_DIR, f'frame_{frame_index:06d}.txt')
        return self._parse_annotation_file(ann_path)
    
    def get_all_frame_annotations(self, project_folder_name, frame_index):
        """
        Получает Ground Truth и предсказания всех моделей для конкретного кадра.
        """
        project_path = self.get_project_path(project_folder_name)
        frame_filename = f'frame_{frame_index:06d}.txt'
        
        # 1. Получаем Ground Truth (Ручная разметка)
        gt_path = os.path.join(project_path, OBJECT_DETECTIONS_DIR, frame_filename)
        ground_truth = self._parse_annotation_file(gt_path)
        
        # 2. Получаем предсказания моделей
        models_result = {}
        analysis_base_path = os.path.join(project_path, ANALYSIS_DIR)
        
        if os.path.exists(analysis_base_path):
            for model_name in os.listdir(analysis_base_path):
                model_dir_path = os.path.join(analysis_base_path, model_name)
                
                if os.path.isdir(model_dir_path):
                    model_ann_path = os.path.join(model_dir_path, frame_filename)
                    models_result[model_name] = self._parse_annotation_file(model_ann_path)

        return {
            'ground_truth': ground_truth,
            'models': models_result
        }
    
    def _parse_annotation_file(self, file_path):
        """
        Внутренний метод: парсит YOLO txt файл и возвращает список словарей.
        """
        annotations = []
        if not os.path.exists(file_path):
            return annotations

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    
                    parts = line.split()
                    label = ' '.join(parts[:-5])
                    
                    try:
                        x, y, w, h, c = map(float, parts[-5:])
                        annotations.append({
                            'label': label,
                            'x': x, 'y': y, 
                            'width': w, 'height': h, 
                            'confidence': c
                        })
                    except ValueError:
                        print(f"Error parsing coordinates in line: {line}")
        except Exception as e:
            print(f"Error reading {file_path}: {e}")
            
        return annotations
    
    def get_project_reports(self, project_folder_name):
        """
        Возвращает список отчетов для указанного проекта.
        """
        reports = []
        project_path = self.get_project_path(project_folder_name)
        analysis_path = os.path.join(project_path, ANALYSIS_DIR)

        if not os.path.exists(analysis_path):
            return reports

        meta = self.load_metadata(project_folder_name)
        project_human_name = meta.get('project_name', project_folder_name) if meta else project_folder_name

        for filename in os.listdir(analysis_path):
            if filename.endswith('.json'):    
                file_path = os.path.join(analysis_path, filename)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        reports.append({
                            "project_name": project_human_name,
                            "dirname": project_folder_name,
                            "filename": filename,
                            "timestamp": data.get("timestamp"),
                            "datetime_iso": data.get("datetime_iso"),
                            "models": data.get("models", []) # Полезно показать, какие модели были в отчете
                        })
                except Exception as e:
                    print(f"Error reading report {file_path}: {e}")
        
        # Сортируем: свежие сверху
        reports.sort(key=lambda x: x['timestamp'] or '', reverse=True)
        return reports
    
    def get_class_statistics(self, project_folder_name, target_class):
        """
        Сканирует все аннотации проекта и собирает статистику по конкретному классу.
        Возвращает: общее кол-во и список кадров, где этот класс встречается.
        """
        project_path = self.get_project_path(project_folder_name)
        annotations_dir = os.path.join(project_path, OBJECT_DETECTIONS_DIR)
        
        if not os.path.exists(annotations_dir):
            return {'total_count': 0, 'frames': []}

        total_count = 0
        frames_with_class = []

        # Получаем все .txt файлы
        annotation_files = sorted(glob.glob(os.path.join(annotations_dir, '*.txt')))

        for file_path in annotation_files:
            try:
                count_in_frame = 0
                with open(file_path, 'r', encoding='utf-8') as f:
                    for line in f:
                        parts = line.strip().split()
                        if len(parts) >= 5:
                            label_in_line = ' '.join(parts[:-5])
                            if label_in_line == target_class:
                                count_in_frame += 1
                
                if count_in_frame > 0:
                    total_count += count_in_frame
                    filename = os.path.basename(file_path)
                    frame_index = int(re.search(r'\d+', filename).group())
                    
                    frames_with_class.append({
                        'frame_index': frame_index,
                        'count': count_in_frame
                    })

            except Exception as e:
                logging.error(f"Error scanning file {file_path}: {e}")

        return {
            'class_name': target_class,
            'total_objects': total_count,
            'frames': frames_with_class
        }