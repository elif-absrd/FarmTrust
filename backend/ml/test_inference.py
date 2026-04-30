#!/usr/bin/env python3
"""
Test inference with actual images to see raw model output.
"""

import argparse
import json
import os
import sys
import warnings
from pathlib import Path

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
warnings.filterwarnings("ignore")

try:
    import numpy as np
    from PIL import Image, ImageOps
except ImportError as e:
    print(f"ERROR: Missing dependencies - {e}")
    sys.exit(1)


def load_interpreter():
    """Load TFLite interpreter"""
    ml_dir = Path(__file__).parent
    model_path = ml_dir / "disease_detection.tflite"
    
    try:
        from tflite_runtime.interpreter import Interpreter
        return Interpreter(model_path=str(model_path))
    except Exception:
        try:
            import tensorflow as tf
            return tf.lite.Interpreter(model_path=str(model_path))
        except Exception as e:
            print(f"ERROR: Cannot load TFLite interpreter - {e}")
            sys.exit(1)


def preprocess_image(image: Image.Image, width: int, height: int):
    """Preprocess image for model"""
    image = image.resize((width, height))
    image_array = np.asarray(image, dtype=np.float32)
    
    # MobileNetV2 preprocessing: (pixel / 127.5) - 1.0
    image_array = (image_array / 127.5) - 1.0
    
    batched = np.expand_dims(image_array, axis=0)
    return batched.astype(np.float32)


def test_image(image_path: str, top_k: int = 15):
    """Test inference on an image"""
    
    ml_dir = Path(__file__).parent
    metadata_path = ml_dir / "model_metadata.json"
    labels_path = ml_dir / "labels.json"
    
    # Load metadata and labels
    try:
        with open(metadata_path) as f:
            metadata = json.load(f)
        with open(labels_path) as f:
            labels = json.load(f)
    except Exception as e:
        print(f"ERROR loading metadata/labels: {e}")
        sys.exit(1)
    
    # Load image
    try:
        image = Image.open(image_path)
        image = ImageOps.exif_transpose(image).convert("RGB")
    except Exception as e:
        print(f"ERROR loading image: {e}")
        sys.exit(1)
    
    # Get model config
    input_config = metadata.get("input", {})
    width = input_config.get("width", 160)
    height = input_config.get("height", 160)
    
    print(f"\n{'='*70}")
    print(f"Image: {image_path}")
    print(f"Size: {image.width}x{image.height}")
    print(f"{'='*70}\n")
    
    # Preprocess
    input_tensor = preprocess_image(image, width, height)
    print(f"Input tensor shape: {input_tensor.shape}")
    print(f"Input tensor dtype: {input_tensor.dtype}")
    print(f"Input tensor range: [{np.min(input_tensor):.3f}, {np.max(input_tensor):.3f}]")
    print(f"Input tensor mean: {np.mean(input_tensor):.3f}, std: {np.std(input_tensor):.3f}\n")
    
    # Run inference
    interpreter = load_interpreter()
    interpreter.allocate_tensors()
    
    input_details = interpreter.get_input_details()[0]
    output_details = interpreter.get_output_details()[0]
    
    interpreter.set_tensor(input_details["index"], input_tensor)
    interpreter.invoke()
    
    raw_output = interpreter.get_tensor(output_details["index"]).astype(np.float32).squeeze()
    
    print(f"Raw output shape: {raw_output.shape}")
    print(f"Raw output dtype: {raw_output.dtype}")
    print(f"Raw output range: [{np.min(raw_output):.6f}, {np.max(raw_output):.6f}]")
    print(f"Raw output mean: {np.mean(raw_output):.6f}, std: {np.std(raw_output):.6f}\n")
    
    # Check for issues
    print("⚠️  ISSUES DETECTED:")
    issues = []
    
    if raw_output.shape[0] != 38:
        issues.append(f"✗ Output has {raw_output.shape[0]} values, expected 38")
    
    if np.allclose(raw_output, raw_output[0]):
        issues.append("✗ All output values are the same (constant)")
    
    if len(np.unique(np.round(raw_output, 6))) <= 2:
        issues.append(f"✗ Only {len(np.unique(np.round(raw_output, 6)))} unique values in output")
    
    if not issues:
        print("  None - output structure looks good\n")
    else:
        for issue in issues:
            print(f"  {issue}")
        print()
    
    # Use raw output if it already looks like probabilities
    output_sum = float(np.sum(raw_output))
    use_softmax = True
    if raw_output.min() >= 0 and raw_output.max() <= 1.0 and abs(output_sum - 1.0) < 0.05:
        probabilities = raw_output
        use_softmax = False
    else:
        shifted = raw_output - np.max(raw_output)
        probabilities = np.exp(shifted) / np.sum(np.exp(shifted))
    
    source_label = "softmax" if use_softmax else "raw"
    print(f"Probabilities ({source_label}):")
    print(f"  Min: {np.min(probabilities):.6f}")
    print(f"  Max: {np.max(probabilities):.6f}")
    print(f"  Sum: {np.sum(probabilities):.6f}\n")
    
    # Top predictions
    top_k = min(top_k, len(labels))
    top_indices = np.argsort(probabilities)[::-1][:top_k]
    
    print(f"Top {top_k} Predictions:")
    print(f"{'-'*70}")
    print(f"{'Rank':<6} {'Class ID':<10} {'Probability':<15} {'Label':<40}")
    print(f"{'-'*70}")
    
    for rank, idx in enumerate(top_indices, 1):
        label_data = labels[idx]
        label = label_data.get('display', label_data.get('raw', f'Class {idx}'))
        prob = probabilities[idx]
        raw_val = raw_output[idx]
        print(f"{rank:<6} {idx:<10} {prob:<15.6f} {label:<40}")
    
    print(f"{'-'*70}\n")
    
    # Check for tomato bias
    tomato_indices = [i for i, l in enumerate(labels) if 'tomato' in l.get('display', '').lower()]
    if tomato_indices:
        tomato_probs = sum(probabilities[i] for i in tomato_indices)
        print(f"Tomato classes combined probability: {tomato_probs:.6f}")
        print(f"Tomato classes: {[labels[i].get('display') for i in tomato_indices]}\n")
    
    # Diagnosis
    max_prob = probabilities[np.argmax(probabilities)]
    if max_prob > 0.95:
        print("⚠️  DIAGNOSIS: Model output is SEVERELY BIASED")
        print("   One class has >95% probability on random/different images")
        print("   Likely causes:")
        print("   1. Model weights are corrupted")
        print("   2. Model was not trained properly")
        print("   3. Model output layer is broken\n")
    elif len(np.unique(np.round(raw_output, 6))) <= 2:
        print("⚠️  DIAGNOSIS: Model output is COLLAPSED/CONSTANT")
        print("   Model returns same values regardless of input")
        print("   Model file is likely CORRUPTED\n")
    elif np.abs(np.mean(probabilities) - 1.0/len(labels)) < 0.001:
        print("⚠️  DIAGNOSIS: Model output is UNIFORM/RANDOM")
        print("   All classes have equal probability")
        print("   Model may not be trained or model file is corrupted\n")
    else:
        print("✓ Model output appears normal")
        print("  Check if image quality/preprocessing is the issue\n")


def main():
    parser = argparse.ArgumentParser(description="Test ML model inference on an image")
    parser.add_argument("image", help="Path to test image")
    parser.add_argument("--top-k", type=int, default=15, help="Show top K predictions")
    
    args = parser.parse_args()
    
    if not Path(args.image).exists():
        print(f"ERROR: Image not found: {args.image}")
        sys.exit(1)
    
    test_image(args.image, args.top_k)


if __name__ == "__main__":
    main()
