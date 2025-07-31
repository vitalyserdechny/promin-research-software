import os, logging
import cv2
import torch
import torch.nn as nn
import numpy as np
import torchvision.transforms as transforms
from PIL import Image

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
    def __init__(self, model_path='weights/Epoch99.pth'):
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