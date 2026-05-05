from PIL import Image, ImageDraw

def make_rounded(img_path, output_path, radius_percent=0.2):
    img = Image.open(img_path).convert("RGBA")
    width, height = img.size
    
    # Create mask
    mask = Image.new('L', (width, height), 0)
    draw = ImageDraw.Draw(mask)
    
    # Calculate radius
    r = int(min(width, height) * radius_percent)
    
    # Draw rounded rectangle on mask
    draw.rounded_rectangle((0, 0, width, height), radius=r, fill=255)
    
    # Apply mask
    img.putalpha(mask)
    
    # Save as PNG
    img.save(output_path, "PNG")
    print(f"Saved rounded icon to {output_path}")

if __name__ == "__main__":
    make_rounded("kaivertion.jpg", "favicon.png", radius_percent=0.2)
