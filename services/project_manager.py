import logging
import math
import os, json, glob

import urllib
from config import UPLOADS_DIR, FRAMES_DIR, OBJECT_DETECTIONS_DIR

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
        project_path = self.get_project_path(project_folder_name) # Твой метод получения пути
        frames_dir = os.path.join(project_path, FRAMES_DIR) # FRAMES_DIR из конфига
        annotations_dir = os.path.join(project_path, OBJECT_DETECTIONS_DIR)

        if not os.path.exists(frames_dir):
            return {
                'frames': [],
                'total_frames': 0,
                'total_pages': 0,
                'current_page': page
            }

        # 1. Получаем список всех файлов (это быстро, пока их не миллион)
        # Сортировка обязательна, чтобы порядок кадров не скакал!
        all_frames = sorted(glob.glob(os.path.join(frames_dir, '*.jpg')))
        total_frames = len(all_frames)
        
        # 2. Вычисляем индексы для среза (slice)
        start = (page - 1) * per_page
        end = start + per_page
        
        # Берем только нужный кусочек списка
        frames_slice = all_frames[start:end]

        frames_data = []

        # 3. Обрабатываем только этот маленький кусочек (50 штук)
        for i, frame_path in enumerate(frames_slice):
            # Реальный индекс кадра во всем видео
            global_frame_index = start + i 
            
            frame_name = os.path.basename(frame_path)
            annotation_path = os.path.join(annotations_dir, frame_name.replace('.jpg', '.txt'))
            
            annotations = []
            if os.path.exists(annotation_path):
                try:
                    with open(annotation_path, 'r') as f:
                        for line in f:
                            parts = line.strip().rsplit(' ', 5)
                            if len(parts) == 6:
                                label = parts[0]
                                x, y, w, h, c = map(float, parts[1:])
                                annotations.append({
                                    'label': label, 'x': x, 'y': y, 
                                    'width': w, 'height': h, 'confidence': c
                                })
                except Exception as e:
                    logging.error(f"Error reading {annotation_path}: {e}")

            # Формируем URL (тут используем твою логику)
            # Важно: project_folder_name должен быть безопасным для URL
            rel_path = os.path.relpath(frame_path, UPLOADS_DIR)
            frame_url = '/uploads/' + urllib.parse.quote(rel_path.replace(os.sep, "/"))

            frames_data.append({
                'frame_index': global_frame_index, # Важно передать реальный индекс!
                'name': frame_name,
                'url': frame_url,
                'annotations': annotations
            })

        # Возвращаем структуру с данными и мета-инфой для фронтенда
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
    