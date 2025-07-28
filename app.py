# Copyright (C) 2025, Serdechny Vitaly
# This file is part of PROMIN AI Research Tool

# FLASK application logic

# 1. Imports
# ---------------------------------------------------------------------------------------
import base64
import datetime, json, logging, torch
import shutil
import glob, os, threading, re, urllib.parse

from utils import *
from flask import Flask, jsonify, render_template, request, redirect, send_from_directory
from flask_socketio import SocketIO

from config import *
# ---------------------------------------------------------------------------------------

# 2. FLASK Application & Socket Setup 
# ---------------------------------------------------------------------------------------
app = Flask(__name__)
socketio = SocketIO(app)
app.config['CURRENT_PROJECT_DIR'] = None
app.config['PROJECTS_INFO'] = None
# ---------------------------------------------------------------------------------------

# 3. Helper Functions
# ---------------------------------------------------------------------------------------
def sanitize_filename(name):
    return re.sub(r'[^a-zA-Z0-9_-]', '_', name)

def process_video(project_dir, is_annontation_required):
    video_to_frames(project_dir, is_annontation_required, socketio)
    project_name = os.path.basename(app.config['CURRENT_PROJECT_DIR'])
    projects_info = app.config.get('PROJECTS_INFO', [])
    print('Processing video completed, emitting socket event...')
    print(f'Project name: {project_name}')
    print(f'Projects info: {projects_info}')
    for project in projects_info:
        if project.get('folder') == project_name:
            project_name = project.get('name', project_name)
            break
    socketio.emit('video-processing-complete', {'message': 'Video processed and frames saved!', 'project_name' : project_name})
    logging.info('Video processed and frames saved!')

def process_model(model_name, detector, frame_paths, annotations_folder, total_frames, preproc_pipeline):
    all_classes = set()
    full_time = 0
    for frame_index, frame_path in enumerate(frame_paths):
        full_time += annotate_frame(frame_path, detector, annotations_folder, all_classes, preproc_pipeline)
        socketio.emit('analysis-progress-update', {
            'message': f'Annotating frames with {model_name}',
            'step': 1,
            'frame': frame_index,
            'total_frames': total_frames
        })
    fps = round(total_frames / full_time) if full_time > 0 else 0
    return fps
# ---------------------------------------------------------------------------------------

# 4. FLASK Routes
# ---------------------------------------------------------------------------------------
@app.route('/') 
def index():
    '''
    Index Route
    \nThis route serves the main page of the application, listing all projects and their metadata.
    '''
    projects = []
    if os.path.exists(UPLOADS_DIR):
        for folder_name in os.listdir(UPLOADS_DIR):
            folder_path = os.path.join(UPLOADS_DIR, folder_name)
            if os.path.isdir(folder_path):
                project_file = os.path.join(folder_path, 'project.json')
                if os.path.exists(project_file):
                    try:
                        with open(project_file, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                            project_name = data.get('project_name', 'Unnamed Project')
                            created_at = data.get('created_at')
                    except Exception as e:
                        project_name = 'Reading error'
                        logging.error(f'Project name reading error {project_file}: {e}')
                else:
                    project_name = 'project.json not found'
                
                projects.append({
                    'folder': folder_name,
                    'name': project_name,
                    'created_at': created_at
                })

    projects.sort(key=lambda x: x['created_at'] or '', reverse=True)
    app.config['PROJECTS_INFO'] = projects
    return render_template('index.html')

@app.route("/ping")
def ping():
    return "", 200

@app.route('/get-projects')
def get_projects():
    return jsonify(app.config['PROJECTS_INFO'])

@app.route('/close-project')
def close_project():
    '''
    Close Project Route
    '''
    app.config['CURRENT_PROJECT_DIR'] = None
    return redirect('/')

@app.route('/uploads/<path:filename>')
def serve_uploaded_file(filename):
    '''
    Serve static files
    '''
    return send_from_directory(UPLOADS_DIR, filename)

@app.route('/check-cuda', methods=['GET'])
def check_cuda_route():
    cuda_available = torch.cuda.is_available()
    devices = []

    if cuda_available:
        num_devices = torch.cuda.device_count()
        for i in range(num_devices):
            devices.append(torch.cuda.get_device_name(i))
    
    return jsonify({
        'status': 'success',
        'cuda_available': cuda_available,
        'cuda_devices': devices
    })

# *******************************************
'''
REPORTS ROUTES
'''
# *******************************************
@app.route('/get-all-reports-info', methods=['GET'])
def get_all_reports_info_route():
    all_reports = []
    
    for project_dir in os.listdir(UPLOADS_DIR):
        project_path = os.path.join(UPLOADS_DIR, project_dir)
        
        if not os.path.isdir(project_path):
            continue
        
        project_name = project_dir
        project_json_path = os.path.join(project_path, 'project.json')
        if os.path.isfile(project_json_path):
            try:
                with open(project_json_path, 'r', encoding='utf-8') as pj_file:
                    project_data = json.load(pj_file)
                    project_name = project_data.get('project_name', project_name)
            except Exception as e:
                logging.error(f"An error occured while reading project.json in {project_path}: {e}")
        
        analysis_path = os.path.join(project_path, 'analysis')
        if not os.path.isdir(analysis_path):
            continue

        # Ищем все JSON-файлы в папке analysis
        for filename in os.listdir(analysis_path):
            if filename.endswith('.json'):
                file_path = os.path.join(analysis_path, filename)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        report_info = {
                            "project_name": project_name,
                            "dirname":  project_dir,
                            "filename": filename,
                            "timestamp": data.get("timestamp"),
                            "datetime_iso": data.get("datetime_iso")
                        }
                        all_reports.append(report_info)
                except Exception as e:
                    logging.error(f"Reading error {file_path}: {e}")

    return jsonify(all_reports)

@app.route('/get-selected-report', methods=['GET'])
def get_selected_report_route():
    filename = request.args.get('filename', type=str)
    if filename is None:
        return jsonify({'status': 'error', 'error': 'filename is required'}), 400
    dirname = request.args.get('dirname', type=str)
    if dirname is None:
        return jsonify({'status': 'error', 'error': 'dirname is required'}), 400
    
    analysis_path = os.path.join(UPLOADS_DIR, dirname, 'analysis')
    file_path = os.path.join(analysis_path, filename)

    if not os.path.isfile(file_path):
        return jsonify({'status': 'error', 'error': 'file not found'}), 404

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            data['filename'] = filename
            return jsonify(data)
    except Exception as e:
        logging.error(f"Error reading file {file_path}: {e}")
        return jsonify({'status': 'error', 'error': 'failed to read the file'}), 500

# *******************************************
'''
PLAYGROUND ROUTES
'''
# *******************************************

@app.route('/annotate-playground-frame', methods=['GET'])
def annotate_playground_frame_route():
    frame_index = request.args.get('frame_index', type=int)
    if frame_index is None:
        return jsonify({'status': 'error', 'error': 'frame_index is required'}), 400
    
    frame_name = f'frame_{frame_index:06d}.jpg'
    playground_dir = os.path.join(app.config['CURRENT_PROJECT_DIR'], '.playground')
    frame_path = os.path.join(playground_dir, frame_name)
    if not os.path.exists(frame_path):
        return jsonify({'error': f'Frame not found: {frame_name}'}), 404
    
    model = request.args.get('model')
    if model is None:
        return jsonify({'status': 'error', 'error': 'model is required'}), 400
    
    # Чтение изображения с диска
    frame = cv2.imread(frame_path)
    if frame is None:
        return jsonify({'error': 'Failed to load frame image'}), 500
    
    detector = None
    for key in DETECTOR_CONFIG:
        if key in model:
            detector = DETECTOR_CONFIG[key](model)
            break
    if not detector:
        return jsonify({'status': 'error', 'error': 'detector not found'}), 400
        
    ann, tm = annotate_frame_in_playground(frame, detector)

    return jsonify({'status': 'success', 'annotations': ann, 'time':tm})                                           

@app.route('/reset-preproc', methods=['GET'])
def reset_preproc_route():
    frame_index = request.args.get('frame_index', type=int)
    if frame_index is None:
        return jsonify({'status': 'error', 'error': 'frame_index is required'}), 400
    
    frame_name = f'frame_{frame_index:06d}.jpg'
    playground_folder = os.path.join(app.config['CURRENT_PROJECT_DIR'], '.playground')
    frames_folder = os.path.join(app.config['CURRENT_PROJECT_DIR'], FRAMES_DIR)

    original_path = os.path.join(frames_folder, frame_name)
    playground_path = os.path.join(playground_folder, frame_name)

    try:
        with open(original_path, 'rb') as src_file:
            original_data = src_file.read()
        with open(playground_path, 'wb') as dst_file:
            dst_file.write(original_data)

        image_base64 = base64.b64encode(original_data).decode('utf-8')
        return jsonify({'status': 'success', 'image_base64': image_base64})
    except Exception as e:
        return jsonify({'status': 'error', 'error': str(e)}), 500


@app.route('/apply-preproc-to-frame', methods=['GET'])
def apply_preproc_to_frame_route():
    frame_index = request.args.get('frame_index', type=int)
    if frame_index is None:
        return jsonify({'error': 'frame_index not provided'}), 400
    
    method = request.args.get('method')
    if method is None:
        return jsonify({'error':'preproc method is invalid'}), 400
    
    # Отдельно — frame и method, остальные — как параметры метода
    method_params = {
        k: v for k, v in request.args.items()
        if k not in ['frame_index', 'method']
    }

    frame_name = f'frame_{frame_index:06d}.jpg'
    playground_dir = os.path.join(app.config['CURRENT_PROJECT_DIR'], '.playground')
    frame_path = os.path.join(playground_dir, frame_name)

    if not os.path.exists(frame_path):
        return jsonify({'error': f'Frame not found: {frame_name}'}), 404
    
    # Чтение изображения с диска
    frame = cv2.imread(frame_path)
    if frame is None:
        return jsonify({'error': 'Failed to load frame image'}), 500

    try:
        result, final_params = apply_preproc(frame, method, **method_params)
    except ValueError as e:
        return jsonify({'error' : str(e)}), 400
    
     # Сохранение в .playground
    playground_dir = os.path.join(app.config['CURRENT_PROJECT_DIR'], '.playground')
    output_path = os.path.join(playground_dir, frame_name)
    cv2.imwrite(output_path, result)

     # Возврат изображения в base64
    _, img_encoded = cv2.imencode('.jpg', result)
    img_base64 = base64.b64encode(img_encoded.tobytes()).decode('utf-8')

    return jsonify({
        'status': 'success',
        'filename': frame_name,
        'image_base64': img_base64,
        "params" : final_params
    })

@app.route('/close-playground', methods=["POST"])
def close_playground():
    playground_dir = os.path.join(app.config['CURRENT_PROJECT_DIR'], '.playground')
    if os.path.exists(playground_dir):
        try:
            shutil.rmtree(playground_dir)
        except Exception as e:
            return jsonify({'error': f'Failed to delete playground: {str(e)}'}), 500
    return jsonify({'status': 'success', 'message': 'Playground closed and cleaned up.'})

@app.route('/initialize-playground', methods=["GET"])
def initialize_playground():
    frame_index = request.args.get('frame_index', type=int)
    if frame_index is None:
        return jsonify({'error': 'frame_index not provided'}), 400
    
    frame_name = f'frame_{frame_index:06d}.jpg'
    frames_folder = os.path.join(app.config['CURRENT_PROJECT_DIR'], FRAMES_DIR)
    frame_path = os.path.join(frames_folder, frame_name)

    if not os.path.exists(frame_path):
        return jsonify({'error': f'Frame not found: {frame_name}'}), 404
    
    # Создание временной папки .playground
    playground_dir = os.path.join(app.config['CURRENT_PROJECT_DIR'], '.playground')
    os.makedirs(playground_dir, exist_ok=True)

    # Копирование изображения
    target_path = os.path.join(playground_dir, frame_name)
    shutil.copy2(frame_path, target_path)

    # Загрузка изображения и кодирование в base64
    with open(target_path, 'rb') as img_file:
        img_data = img_file.read()
        encoded_img = base64.b64encode(img_data).decode('utf-8')

    return jsonify({
        'status': 'success',
        'filename': frame_name,
        'image_base64': encoded_img
    })

# *******************************************

@app.route('/get-frame-annotations', methods=["GET"])
def get_frame_annotations():
    '''
    Get all frames annotations for a specific frame (including ground truth and model predictions)
    \nWARNING: model predictions are available only after running analysis!
    '''
    frame_index = request.args.get('frame_index', type=int)
    frame_name = f'frame_{frame_index:06d}.txt'

    annotations_folder = os.path.join(app.config['CURRENT_PROJECT_DIR'], OBJECT_DETECTIONS_DIR)
    analysis_base_path = os.path.join(app.config['CURRENT_PROJECT_DIR'], ANALYSIS_DIR)
    
    analysis_folders = []
    if os.path.exists(analysis_base_path):
        analysis_folders = [f for f in os.listdir(analysis_base_path) 
                           if os.path.isdir(os.path.join(analysis_base_path, f))]

    truth_annotation_path = os.path.join(annotations_folder, frame_name)

    result = {
        'ground_truth': [],
        'models': {}
    }

    if os.path.exists(truth_annotation_path):
        try:
            with open(truth_annotation_path, 'r') as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    
                    parts = line.split()
                    label = ' '.join(parts[:-5])
                    try:
                        x, y, w, h, c = map(float, parts[-5:])
                        result['ground_truth'].append({
                            'label': label,
                            'x': x,
                            'y': y,
                            'width': w,
                            'height': h,
                            'confidence': c
                        })
                    except ValueError:
                        logging.error(f"Error parsing coordinates in line: {line}")
        except Exception as e:
            logging.error(f"Error reading {truth_annotation_path}: {e}")
    
    for model_name in analysis_folders:
        model_annotation_path = os.path.join(analysis_base_path, model_name, frame_name)
        model_annotations = []
        
        if os.path.exists(model_annotation_path):
            try:
                with open(model_annotation_path, 'r') as f:
                    for line in f:
                        line = line.strip()
                        if not line:
                            continue
                            
                        parts = line.split()
                        label = ' '.join(parts[:-5])
                        try:
                            x, y, w, h, c = map(float, parts[-5:])
                            model_annotations.append({
                                'label': label,
                                'x': x,
                                'y': y,
                                'width': w,
                                'height': h,
                                'confidence': c
                            })
                        except ValueError:
                            logging.error(f"Error parsing coordinates in line: {line} for model {model_name}")
            except Exception as e:
                logging.error(f"Error reading {model_annotation_path}: {e}")
        
        result['models'][model_name] = model_annotations

    return jsonify(result)


@app.route('/run-analysis', methods=["POST"])
def run_analysis():
    '''
    Run analysis route (POST request initiated from the client by starting analysis after frames are annotated)
    '''
    data = request.get_json()
    models = data.get('models', [])
    preproc_pipeline = data.get('preprocessing_pipeline', [])

    logging.info(f"Running analysis with models: {models}")
    logging.info(f"Preprocessing pipeline:\n {preproc_pipeline}")

    frames_folder = os.path.join(app.config['CURRENT_PROJECT_DIR'], FRAMES_DIR)
    analysis_folder = os.path.join(app.config['CURRENT_PROJECT_DIR'], ANALYSIS_DIR)
    if not os.path.exists(analysis_folder):
        os.makedirs(analysis_folder)

    frame_paths = sorted(glob.glob(os.path.join(frames_folder, '*.jpg')))
    total_frames = len(frame_paths)

    timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    analysis_file_name = f"analysis_result_{timestamp}.json"
    analysis_results_file = os.path.join(analysis_folder, analysis_file_name)

    results = {}

    for model in models:
        logging.info(f"Calculating annotations and metrics for {model}")
        detector = None
        for key in DETECTOR_CONFIG:
            if key in model:
                detector = DETECTOR_CONFIG[key](model)
                break
        if not detector:
            logging.error(f"Unknown model type in {model}. Skipping analysis for this model.")
            continue

        model_folder = os.path.join(analysis_folder, model)
        os.makedirs(model_folder, exist_ok=True)

        fps = process_model(model, detector, frame_paths, model_folder, total_frames, preproc_pipeline)

        socketio.emit('analysis-progress-update', {'message': f'Calculating metrics for {model}', 'step': 2})
        annotations_folder = os.path.join(app.config['CURRENT_PROJECT_DIR'], 'object-detections')
        metrics = calculate_metrics(annotations_folder, model_folder)
        results[model] = {'FPS': fps, **metrics}

    analysis_metadata = {
        "timestamp": timestamp,
        "datetime_iso": datetime.datetime.now().isoformat(),
        "models": models,
        "preprocessing_pipeline": preproc_pipeline, 
        "results": results
    }

    with open(analysis_results_file, 'w') as f:
        json.dump(analysis_metadata, f, indent=4)

    return jsonify(results)


@app.route('/save-project-data', methods=["POST"])
def save_project_data():
    '''
    Save project data route
    \nThis route saves the last frame index, last page number, and classes and colors to the project.json file.
    \nIt expects a JSON payload with keys: last_frame_index, page_number, and classes_and_colors.
    \nIf the project.json file does not exist, it returns a 404 error.
    \nIf there is an error while saving the data, it returns a 500 error with the error message.
    '''
    data = request.get_json()
    prj_file_path = os.path.join(app.config['CURRENT_PROJECT_DIR'], 'project.json')

    if not os.path.exists(prj_file_path):
        return jsonify({'message': 'Project file not found!'}), 404

    try:
        with open(prj_file_path, 'r', encoding='utf-8') as f:
            project_data = json.load(f)

        project_data['last_frame_index'] = data.get('last_frame_index', 0)
        project_data['last_page_number'] = data.get('page_number', 1)
        project_data['classes'] = data.get('classes_and_colors', {})

        with open(prj_file_path, 'w', encoding='utf-8') as f:
            json.dump(project_data, f, indent=4)
        return jsonify({'message': 'Project data saved successfully!'})
    except Exception as e:
        return jsonify({'message': f'Error saving project data: {e}'}), 500

@app.route("/save-annotations", methods=["POST"])
def save_annotations():
    data = request.get_json()
    for frame_data in data:
        frame_index = frame_data["frame_index"]
        annotations = frame_data["annotations"]

        annotations_folder = os.path.join(app.config['CURRENT_PROJECT_DIR'], OBJECT_DETECTIONS_DIR)
        if not os.path.exists(annotations_folder):
            os.makedirs(annotations_folder)

        annotation_path = os.path.join(annotations_folder, f'frame_{frame_index:06d}.txt')

        with open(annotation_path, 'w') as f:
            for annotation in annotations:
                x = annotation['x']
                y = annotation['y']
                w = annotation['width']
                h = annotation['height']
                c = annotation['confidence']
                label = annotation['label']
                f.write(f'{label} {x} {y} {w} {h} {c}\n')
    
    return jsonify({'message': 'Annotations saved successfully!'})

@app.route('/get-last-frame-and-page-number')
def get_last_frame_and_page_number():
    last_frame_index = 0
    page_number = 1

    try:
        project_json_path = os.path.join(app.config['CURRENT_PROJECT_DIR'], 'project.json')
        if os.path.exists(project_json_path):
            with open(project_json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                last_frame_index = data.get('last_frame_index', 0)
                page_number = data.get('last_page_number', 1)
    except Exception as e:
        logging.error(f"Error reading project.json: {e}")

    return jsonify({'last_frame_index': last_frame_index, 'page_number': page_number})

@app.route('/get-classes-colors')
def get_classes_colors():
    classes_colors = {}

    project_json_path = os.path.join(app.config['CURRENT_PROJECT_DIR'], 'project.json')

    if os.path.exists(project_json_path):
        try:
            with open(project_json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                classes_colors = data.get('classes', {})
        except Exception as e:
            print(f"Error reading project.json: {e}")

    return jsonify(classes_colors)

@app.route('/get-frames')
def get_frames():
    frames_folder = os.path.join(app.config['CURRENT_PROJECT_DIR'], FRAMES_DIR)
    annotations_folder = os.path.join(app.config['CURRENT_PROJECT_DIR'], OBJECT_DETECTIONS_DIR)

    if not os.path.exists(frames_folder):
        return jsonify([])

    frame_files = sorted(glob.glob(os.path.join(frames_folder, '*.jpg')))
    frames_data = []

    frame_index = 0
    for frame_path in frame_files:
        frame_name = os.path.basename(frame_path)
        annotation_path = os.path.join(annotations_folder, frame_name.replace('.jpg', '.txt'))

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
                                'label': label,
                                'x': x,
                                'y': y,
                                'width': w,
                                'height': h,
                                'confidence': c
                            })
                        else:
                            logging.warning(f"Skipping malformed annotation: {line}")
            except Exception as e:
                logging.error(f"Error reading {annotation_path}: {e}")

        frame_url = '/uploads/' + urllib.parse.quote(os.path.relpath(frame_path, UPLOADS_DIR).replace(os.sep, "/"))

        frames_data.append({
            'frame_index' : frame_index,
            'url': frame_url,
            'annotations': annotations
        })
        frame_index += 1

    return jsonify(frames_data)

@app.route('/open')
def open_project():
    requested_name = request.args.get('project_name')
    projects_info = app.config.get('PROJECTS_INFO', [])

    matching_project = next(
        (p for p in projects_info if p['name'] == requested_name), None
    )

    if not matching_project:
        return f"Project '{requested_name}' not found.", 404

    project_folder = os.path.join(UPLOADS_DIR, matching_project['folder'])
    app.config['CURRENT_PROJECT_DIR'] = project_folder

    return render_template('frames-operations.html', project_name=requested_name)

@app.route('/upload', methods=['POST'])
def upload_video():
    '''
    Upload video file and create a new project
    \nThis route handles the video upload, creates a project directory, and starts processing the video.
    \nIt also saves the project metadata in a JSON file.
    \nThe video is processed in a separate thread to avoid blocking the main thread.
    \nAfter processing, it emits a socket event to notify the client about completion.
    '''

    file = request.files.get('video')
    project_name_raw = request.form.get('project_name', 'unnamed_project')
    is_annontation_required = 'annotate_frames' in request.form
    
    if not file or file.filename == '':
        return redirect(request.url )
    
    if not os.path.exists(UPLOADS_DIR): 
        os.makedirs(UPLOADS_DIR)

    timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    safe_project_name = sanitize_filename(project_name_raw)
    full_project_name = f'{safe_project_name}_{timestamp}'

    project_folder = os.path.join(UPLOADS_DIR, full_project_name)
    os.makedirs(project_folder, exist_ok=True)

    filename = f'video{os.path.splitext(file.filename)[1]}' 
    video_path = os.path.join(project_folder, filename)
    file.save(video_path)

    # Save project file
    frames_folder = os.path.join(project_folder, FRAMES_DIR)
    detections_folder = os.path.join(project_folder, OBJECT_DETECTIONS_DIR)
    os.makedirs(frames_folder, exist_ok=True)
    os.makedirs(detections_folder, exist_ok=True)

    project_info = {
        'project_name': project_name_raw,
        'created_at': timestamp,
        'last_frame_index': 0,
        'last_page_number': 1,
        'classes': {},
    }

    app.config['CURRENT_PROJECT_DIR'] = project_folder
    app.config['PROJECTS_INFO'].append({
        'folder': full_project_name,
        'name': project_name_raw,
        'created_at': timestamp
    })

    project_info_path = os.path.join(project_folder, 'project.json')
    with open(project_info_path, 'w', encoding='utf-8') as f:
        json.dump(project_info, f, indent=4)

    threading.Thread(target=process_video, args=(project_folder, is_annontation_required, )).start()
    return render_template('video-processing.html', message=f'File {filename} uploaded successfully', project_name=project_name_raw)

# -------------------------------------------------------------------------
# 5. Main Application Logic

if __name__ == '__main__':
    app.run(debug=True)