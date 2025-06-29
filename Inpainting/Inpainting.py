from flask import Flask, request, jsonify, send_file
from PIL import Image
import torch
import io
from diffusers import AutoPipelineForInpainting
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route("/inpainting", methods=["POST"])
def inpainting():
    try:
        prompt = request.form["prompt"]
        image_file = request.files["image"]
        mask_file = request.files["mask"]

        init_image = Image.open(image_file).convert("RGB")
        mask_image = Image.open(mask_file).convert("L")

        model_id = "stabilityai/stable-diffusion-2-inpainting"

        pipeline = AutoPipelineForInpainting.from_pretrained(
            model_id,
            torch_dtype=torch.float16,
            variant="fp16"
        ).to("cuda")

        generator = torch.Generator("cuda").manual_seed(92)

        result = pipeline(
            prompt=prompt,
            num_inference_steps=30,
            image=init_image,
            mask_image=mask_image,
            generator=generator,
            strength=0.85,
            guidance_scale=10.0,
            padding_mask_crop=3
        ).images[0]

        img_io = io.BytesIO()
        result.save(img_io, 'PNG')
        img_io.seek(0)
        return send_file(img_io, mimetype='image/png')

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5002, debug=True)