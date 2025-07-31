import os, logging
import cv2, time
import torch
import torch.nn as nn
import numpy as np
import torchvision.transforms as transforms
from PIL import Image

from lowlight_dataset import LowLightDataset
from loss_calculator import LossCalculator

from torch.utils.data import DataLoader

# DCE-Net модель 
# В соответствии с оригинальной реализацией Zero-DCE
# https://arxiv.org/abs/2001.06826

class DCENet(nn.Module):
    def __init__(self):
        super(DCENet, self).__init__()     
         
        self.relu = nn.ReLU(inplace=True)
        self.e_conv1 = nn.Conv2d(3, 32, 3, 1, 1, bias=True) 
        self.e_conv2 = nn.Conv2d(32, 32, 3, 1, 1, bias=True) 
        self.e_conv3 = nn.Conv2d(32, 32, 3, 1, 1, bias=True) 
        self.e_conv4 = nn.Conv2d(32, 32, 3, 1, 1, bias=True) 
        self.e_conv5 = nn.Conv2d(32 * 2, 32, 3, 1, 1, bias=True) 
        self.e_conv6 = nn.Conv2d(32 * 2, 32, 3, 1, 1, bias=True) 
        self.e_conv7 = nn.Conv2d(32 * 2, 24, 3, 1, 1, bias=True)

    def forward(self, x):
        x1 = self.relu(self.e_conv1(x))
        x2 = self.relu(self.e_conv2(x1))
        x3 = self.relu(self.e_conv3(x2))
        x4 = self.relu(self.e_conv4(x3))
        
        x5 = self.relu(self.e_conv5(torch.cat([x3, x4], 1)))
        x6 = self.relu(self.e_conv6(torch.cat([x2, x5], 1)))
        x_r = torch.tanh(self.e_conv7(torch.cat([x1, x6], 1)))
        
        return x_r
    
class ZeroDCEProcessor:
    def __init__(self, model_path='Epoch99.pth'):
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.model = DCENet().to(self.device)
        
        if model_path and os.path.exists(model_path):
            logging.info(f"Loading a pre-trained model: {model_path}")
            checkpoint = torch.load(model_path, map_location=self.device)
            self.model.load_state_dict(checkpoint)
            print("The model has been loaded!")
        else:
            logging.error(f"ERROR: Model {model_path} not found!")
        
        self.model.eval()
        
        self.transform = transforms.Compose([
            transforms.ToTensor()
        ])

        self.loss_calculator = LossCalculator()

    def enhance_image(self, cv_image):
        try:
            rgb_image = cv2.cvtColor(cv_image, cv2.COLOR_BGR2RGB)
            pil_image = Image.fromarray(rgb_image)
            input_tensor = self.transform(pil_image).unsqueeze(0).to(self.device)
                
            with torch.no_grad():
                enhanced_maps = self.model(input_tensor)
                enhanced_image = self.apply_enhancement(input_tensor, enhanced_maps)
                    
                enhanced_np = enhanced_image.squeeze(0).cpu().numpy()
                enhanced_np = np.transpose(enhanced_np, (1, 2, 0))
                enhanced_np = np.clip(enhanced_np * 255, 0, 255).astype(np.uint8)
                    
                enhanced_bgr = cv2.cvtColor(enhanced_np, cv2.COLOR_RGB2BGR)
                return enhanced_bgr             
        except Exception as e:
            logging.error(f"Image processing error: {e}")
            return cv_image  
    
    def apply_enhancement(self, image, enhancement_maps):
        enhanced = image
        for i in range(enhancement_maps.shape[1] // 3):
            r_map = enhancement_maps[:, i*3:(i+1)*3, :, :]
            enhanced = enhanced + r_map * (torch.pow(enhanced, 2) - enhanced)
        return enhanced
    
    def train_model(self, data_dir, epochs=100, batch_size=16, learning_rate=1e-4, save_interval=10, save_path='checkpoints'):
        """
        Обучает модель DCE-Net на заданном датасете.

        Args:
            data_dir (str): Путь к директории с тренировочными изображениями.
            epochs (int): Количество эпох для обучения.
            batch_size (int): Размер батча.
            learning_rate (float): Скорость обучения.
            save_interval (int): Интервал (в эпохах) для сохранения чекпоинтов модели.
            save_path (str): Директория для сохранения чекпоинтов.
        """
        self.model.train() # Переводим модель в режим обучения

        # Подготовка датасета и загрузчика данных
        dataset = LowLightDataset(img_dir=data_dir, transform=self.transform)
        dataloader = DataLoader(dataset, batch_size=batch_size, shuffle=True, num_workers=os.cpu_count() if os.cpu_count() else 0)

        # Оптимизатор
        optimizer = torch.optim.Adam(self.model.parameters(), lr=learning_rate)

        # Создаем директорию для сохранения чекпоинтов, если ее нет
        os.makedirs(save_path, exist_ok=True)

        logging.info(f"Starting training for {epochs} epochs...")
        logging.info(f"Training on {self.device}")

        for epoch in range(epochs):
            start_time = time.time()
            epoch_loss = 0
            
            for batch_idx, original_image_batch in enumerate(dataloader):
                original_image_batch = original_image_batch.to(self.device)

                optimizer.zero_grad() # Обнуляем градиенты

                # Прямой проход: получаем карты усиления
                enhancement_maps = self.model(original_image_batch)
                
                # Применяем усиление к оригинальному изображению
                enhanced_image_batch = self.apply_enhancement(original_image_batch, enhancement_maps)

                # Вычисляем общие потери
                total_loss = self.loss_calculator.total_loss(
                    original_image_batch, enhanced_image_batch, enhancement_maps
                )
                
                # Обратный проход и оптимизация
                total_loss.backward() # Вычисление градиентов
                optimizer.step()     # Обновление весов модели

                epoch_loss += total_loss.item()

                if batch_idx % 50 == 0: # Логируем каждые 50 батчей
                    logging.info(f"Epoch: {epoch+1}/{epochs}, Batch: {batch_idx}/{len(dataloader)}, Loss: {total_loss.item():.6f}")

            avg_epoch_loss = epoch_loss / len(dataloader)
            end_time = time.time()
            logging.info(f"Epoch {epoch+1} finished. Avg Loss: {avg_epoch_loss:.6f}, Time: {(end_time - start_time):.2f}s")

            # Сохраняем модель
            if (epoch + 1) % save_interval == 0:
                model_save_path = os.path.join(save_path, f"Epoch{epoch+1}.pth")
                torch.save(self.model.state_dict(), model_save_path)
                logging.info(f"Model saved to {model_save_path}")

        logging.info("Training complete!")