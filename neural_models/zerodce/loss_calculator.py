import torch
import torch.nn.functional as F

class LossCalculator:
    def __init__(self):
        pass

    # 1. Потеря освещенности (Illumination Smoothness Loss)
    # Поощряет плавность карты усиления.
    def smoothness_loss(self, x_r):
        dx_r = torch.abs(x_r[:, :, :, :-1] - x_r[:, :, :, 1:])
        dy_r = torch.abs(x_r[:, :, :-1, :] - x_r[:, :, 1:, :])
        # Сумма абсолютных разностей по горизонтали и вертикали
        # Используется для alpha-карт, чтобы они были гладкими
        return torch.mean(dx_r + dy_r)

    # 2. Потеря пространственной консистентности (Spatial Consistency Loss)
    # Сохраняет соседство пикселей после усиления.
    # Encourages enhanced pixels to maintain their spatial relationships.
    def spatial_consistency_loss(self, enhanced_image, original_image):
        # Градиенты по горизонтали
        grad_e_h = torch.abs(enhanced_image[:, :, :, :-1] - enhanced_image[:, :, :, 1:])
        grad_o_h = torch.abs(original_image[:, :, :, :-1] - original_image[:, :, :, 1:])
        
        # Градиенты по вертикали
        grad_e_v = torch.abs(enhanced_image[:, :, :-1, :] - enhanced_image[:, :, 1:, :])
        grad_o_v = torch.abs(original_image[:, :, :-1, :] - original_image[:, :, 1:, :])

        # Среднеквадратичная ошибка между градиентами усиленного и оригинального изображений
        loss_h = torch.mean(F.relu(grad_e_h - grad_o_h)) # ReLU для штрафа только при увеличении градиента
        loss_v = torch.mean(F.relu(grad_e_v - grad_o_v))
        
        return loss_h + loss_v

    # 3. Потеря цвета (Color Constancy Loss)
    # Предотвращает цветовые сдвиги, сохраняя отношения RGB каналов.
    def color_constancy_loss(self, enhanced_image):
        mean_rgb = torch.mean(enhanced_image, dim=(2, 3), keepdim=True) # Среднее по высоте и ширине
        r_mean, g_mean, b_mean = mean_rgb[:, 0], mean_rgb[:, 1], mean_rgb[:, 2]

        # Штрафуем отклонения от идеального баланса белого (т.е. R=G=B)
        # (R-G)^2 + (R-B)^2 + (G-B)^2
        loss = torch.pow(r_mean - g_mean, 2) + torch.pow(r_mean - b_mean, 2) + torch.pow(g_mean - b_mean, 2)
        return torch.mean(loss)

    # 4. Потеря экспозиции (Exposure Control Loss)
    # Контролирует общую яркость, чтобы не было пересветов или недосветов.
    # Стремится к среднему значению пикселей в районе 0.6 (как предложено в статье)
    def exposure_control_loss(self, enhanced_image, target_exposure=0.6):
        # Просто возьмем среднее по всему изображению (можно также разделить изображение на патчи, как в некоторых реализациях)
        avg_intensity = torch.mean(enhanced_image, dim=(2, 3))
        # Штраф за отклонение от целевой экспозиции
        return torch.mean(torch.pow(avg_intensity - target_exposure, 2))

    # Комбинированная функция потерь
    def total_loss(self, original_image, enhanced_image, x_r,
                   w_smooth=200, w_spatial=10, w_color=5, w_exposure=1):
        loss_s = self.smoothness_loss(x_r) * w_smooth
        loss_c = self.color_constancy_loss(enhanced_image) * w_color
        loss_e = self.exposure_control_loss(enhanced_image) * w_exposure
        loss_spa = self.spatial_consistency_loss(enhanced_image, original_image) * w_spatial
        
        return loss_s + loss_c + loss_e + loss_spa