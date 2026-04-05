import cv2
import numpy as np

# List of your 10 images (adjust the path/pattern if needed)
image_files = [f"fog_{i:02d}.png" for i in range(1, 11)]

# Load images
imgs = [cv2.imread(f) for f in image_files]
if any(img is None for img in imgs):
    missing = [f for img, f in zip(imgs, image_files) if img is None]
    raise FileNotFoundError(f"Could not load: {missing}")

# Ensure all images are the same size by cropping to the smallest dimensions
min_height = min(img.shape[0] for img in imgs)
min_width  = min(img.shape[1] for img in imgs)
imgs = [img[:min_height, :min_width] for img in imgs]

# Settings: 2 fps means twice the speed of the earlier 5 fps example (half as many frames)
fps = 2
total_duration_sec = 120  # 2 minutes
num_images = len(imgs)
segment_duration = total_duration_sec / num_images  # seconds each image transitions
frames_per_segment = int(segment_duration * fps)

# Prepare the video writer using a widely compatible codec
output_path = "fog_loop_10images.mp4"
fourcc = cv2.VideoWriter_fourcc(*'avc1')  # use 'avc1' or 'H264' instead of 'mp4v'
writer = cv2.VideoWriter(output_path, fourcc, fps, (min_width, min_height), True)

# Create blended frames for each transition (including wraparound from last to first)
for i in range(num_images):
    img1 = imgs[i].astype(np.float32)
    img2 = imgs[(i + 1) % num_images].astype(np.float32)
    for f in range(frames_per_segment):
        # alpha goes from 0.0 to 1.0 across the segment
        alpha = f / max(frames_per_segment - 1, 1)
        blended = cv2.addWeighted(img1, 1 - alpha, img2, alpha, 0)
        writer.write(blended.astype(np.uint8))

writer.release()
print(f"Video saved to {output_path}")