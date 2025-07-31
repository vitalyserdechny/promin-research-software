from torch.utils.data import Dataset
from PIL import Image

import logging, os

class LowLightDataset(Dataset):
    def __init__(self, img_dir, transform=None):
        """
        Args:
            img_dir (str): Директория с изображениями.
            transform (callable, optional): Необязательные преобразования, применяемые к изображению.
        """
        self.img_dir = img_dir
        self.transform = transform
        self.image_files = [f for f in os.listdir(img_dir) if f.endswith(('png', 'jpg', 'jpeg', 'bmp', 'tiff'))]
        
        logging.info(f"Found {len(self.image_files)} images in {self.img_dir}")

    def __len__(self):
        return len(self.image_files)

    def __getitem__(self, idx):
        img_name = os.path.join(self.img_dir, self.image_files[idx])
        
        # Загрузка изображения PIL
        # Предполагаем, что изображения RGB или будут конвертированы
        image = Image.open(img_name).convert('RGB')
        
        if self.transform:
            image = self.transform(image)
            
        return image