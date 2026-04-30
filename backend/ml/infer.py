#!/usr/bin/env python3
"""
FarmTrust ML Model Inference Script
Runs TensorFlow Lite model for plant disease detection
Used by Node.js backend for API predictions
"""

import sys
import json
import argparse
import numpy as np
from pathlib import Path
from PIL import Image
import tensorflow as tf

# ============================================================================
# Configuration
# ============================================================================
IMAGE_SIZE = 224
CONFIDENCE_THRESHOLD = 0.35  # Balance strictness with typical multi-class scores
TOP_K_RESULTS = 5
MIN_GREEN_RATIO = 0.15  # At least 15% green (plants are green)
MIN_SATURATION = 0.15   # Some color saturation (not grayscale)


# ============================================================================
# Load Labels
# ============================================================================
def load_labels(labels_path):
    """Load labels from JSON file"""
    try:
        with open(labels_path, 'r') as f:
            labels = json.load(f)
        
        # Handle different label formats
        if isinstance(labels, list):
            # Array format: [{display: "...", raw: "..."}, ...]
            return [item.get('display', item.get('raw', '')) for item in labels]
        elif isinstance(labels, dict):
            # Dict format: {0: "label", 1: "label", ...}
            return [labels.get(str(i), f'Class {i}') for i in range(len(labels))]
        else:
            raise ValueError(f"Unexpected labels format: {type(labels)}")
    except Exception as e:
        print(f"ERROR: Failed to load labels from {labels_path}", file=sys.stderr)
        print(f"Detail: {str(e)}", file=sys.stderr)
        sys.exit(1)


# ============================================================================
# Image Quality Validation
# ============================================================================
def validate_image_quality(image_path):
    """Check if image looks like a plant/leaf image"""
    try:
        img = Image.open(image_path).convert('RGB')
        img_array = np.array(img, dtype=np.float32) / 255.0
        
        # Calculate green channel ratio (plants are predominantly green)
        r, g, b = img_array[:,:,0], img_array[:,:,1], img_array[:,:,2]
        green_dominance = np.mean(g > (r + b) / 2)  # Green > avg of red and blue
        
        # Calculate saturation (HSV)
        max_rgb = np.maximum(np.maximum(r, g), b)
        min_rgb = np.minimum(np.minimum(r, g), b)
        saturation = np.where(max_rgb > 0, (max_rgb - min_rgb) / max_rgb, 0)
        mean_saturation = np.mean(saturation)
        
        # Calculate uniformity (how uniform is the color)
        # If image is very uniform (like a solid background), it's likely not a plant
        std_r = np.std(r)
        std_g = np.std(g)
        std_b = np.std(b)
        avg_std = (std_r + std_g + std_b) / 3
        
        # Edge detection to check for plant-like complexity (numpy-only)
        gray = np.mean(img_array, axis=2)
        edges_x = np.abs(gray[:, 1:] - gray[:, :-1])
        edges_y = np.abs(gray[1:, :] - gray[:-1, :])
        edge_density = (np.mean(edges_x > 0.1) + np.mean(edges_y > 0.1)) / 2
        
        print(f"DEBUG QUALITY: green_dominance={green_dominance:.2%}, saturation={mean_saturation:.2%}, edge_density={edge_density:.2%}, color_variation={avg_std:.3f}", file=sys.stderr)
        
        # Quality checks
        quality_issues = []
        
        if green_dominance < MIN_GREEN_RATIO:
            quality_issues.append(f"Low green channel ({green_dominance:.0%}, need {MIN_GREEN_RATIO:.0%})")
        
        if mean_saturation < MIN_SATURATION:
            quality_issues.append(f"Low saturation ({mean_saturation:.0%}, need {MIN_SATURATION:.0%})")
        
        if avg_std < 0.05:
            quality_issues.append("Image is too uniform (solid color)")
        
        if edge_density < 0.05:
            quality_issues.append("Not enough edges/texture (not a plant)")
        
        if quality_issues:
            print(f"DEBUG QUALITY ISSUES: {'; '.join(quality_issues)}", file=sys.stderr)
            return False, quality_issues
        
        return True, []
    
    except Exception as e:
        print(f"WARNING: Could not validate image quality: {str(e)}", file=sys.stderr)
        return True, []  # Pass through if validation fails


# ============================================================================
# Load and Preprocess Image
# ============================================================================
def load_and_preprocess_image(image_path, image_size=IMAGE_SIZE, input_dtype=np.float32):
    """Load and preprocess image for model inference"""
    try:
        # Load image
        img = Image.open(image_path).convert('RGB')
        
        # Resize
        img = img.resize((image_size, image_size), Image.Resampling.LANCZOS)
        
        # Convert to array
        img_array = np.array(img, dtype=np.float32)

        # Preprocess based on expected dtype
        if input_dtype == np.uint8:
            img_array = np.clip(img_array, 0, 255).astype(np.uint8)
        else:
            # MobileNetV2 preprocessing: (pixel / 127.5) - 1.0
            img_array = (img_array / 127.5) - 1.0
            img_array = img_array.astype(np.float32)
        
        # Add batch dimension
        img_array = np.expand_dims(img_array, axis=0)
        
        return img_array
    except Exception as e:
        print(f"ERROR: Failed to load image from {image_path}", file=sys.stderr)
        print(f"Detail: {str(e)}", file=sys.stderr)
        sys.exit(1)


# ============================================================================
# Run Inference
# ============================================================================
def run_inference(model_path, image_path, labels):
    """Run TensorFlow Lite model inference"""
    try:
        # Load TFLite model
        interpreter = tf.lite.Interpreter(model_path=model_path)
        interpreter.allocate_tensors()
        
        # Get input and output details
        input_details = interpreter.get_input_details()
        output_details = interpreter.get_output_details()
        
        if not input_details or not output_details:
            raise ValueError("Model has no input or output details")
        
        print(f"DEBUG: Input shape: {input_details[0]['shape']}, dtype: {input_details[0]['dtype']}", file=sys.stderr)
        print(f"DEBUG: Output shape: {output_details[0]['shape']}, dtype: {output_details[0]['dtype']}", file=sys.stderr)
        
        # Prepare input
        input_dtype = input_details[0]['dtype']
        img_array = load_and_preprocess_image(image_path, input_dtype=input_dtype)
        
        print(f"DEBUG: Preprocessed image shape: {img_array.shape}, min: {img_array.min()}, max: {img_array.max()}", file=sys.stderr)
        
        # Verify input shape
        expected_shape = input_details[0]['shape']
        if img_array.shape != tuple(expected_shape):
            print(f"WARNING: Expected shape {expected_shape}, got {img_array.shape}", file=sys.stderr)
            # Try to reshape if needed
            img_array = img_array.reshape(expected_shape)
        
        # Convert to appropriate data type
        print(f"DEBUG: Input dtype required: {input_dtype}", file=sys.stderr)
        if img_array.dtype != input_dtype:
            img_array = img_array.astype(input_dtype)
        
        print(f"DEBUG: Final input array shape: {img_array.shape}, dtype: {img_array.dtype}, min: {img_array.min()}, max: {img_array.max()}", file=sys.stderr)
        
        # Run inference
        interpreter.set_tensor(input_details[0]['index'], img_array)
        interpreter.invoke()
        
        # Get output
        output_data = interpreter.get_tensor(output_details[0]['index']).squeeze()
        
        print(f"DEBUG: Raw output shape: {output_data.shape}, dtype: {output_data.dtype}", file=sys.stderr)
        print(f"DEBUG: Raw output range - min: {output_data.min()}, max: {output_data.max()}, mean: {output_data.mean()}", file=sys.stderr)
        print(f"DEBUG: First 5 outputs: {output_data[:5]}", file=sys.stderr)
        
        # Ensure output is 1D
        if output_data.ndim > 1:
            output_data = output_data.flatten()
        
        # Check if all zeros
        if np.all(output_data == 0):
            print(f"WARNING: Model output is all zeros! Check if model was trained properly.", file=sys.stderr)
        
        # Convert to probabilities
        # Check if values are in log space (very negative numbers)
        if output_data.min() < -10:
            print(f"DEBUG: Output appears to be in log space, applying softmax", file=sys.stderr)
            probabilities = np.exp(output_data) / np.sum(np.exp(output_data))
        # Check if values are already probabilities (0-1)
        elif output_data.max() <= 1.0 and output_data.min() >= 0:
            print(f"DEBUG: Output appears to be probabilities already", file=sys.stderr)
            probabilities = output_data
        else:
            print(f"DEBUG: Output has unexpected range, applying softmax", file=sys.stderr)
            probabilities = np.exp(output_data) / np.sum(np.exp(output_data))
        
        print(f"DEBUG: Final probabilities range - min: {probabilities.min()}, max: {probabilities.max()}", file=sys.stderr)
        print(f"DEBUG: Top 5 predictions: {np.argsort(probabilities)[::-1][:5]}", file=sys.stderr)
        
        return probabilities
    except Exception as e:
        print(f"ERROR: Inference failed", file=sys.stderr)
        print(f"Detail: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)


# ============================================================================
# Format Results
# ============================================================================
def format_results(probabilities, labels, expected_crop=None, image_path=None):
    """Format inference results as JSON"""
    # Get top-k predictions
    top_indices = np.argsort(probabilities)[::-1][:TOP_K_RESULTS]
    
    predictions = []
    for idx in top_indices:
        if idx < len(labels):
            label = labels[idx]
            confidence = float(probabilities[idx])
            
            # Filter by confidence threshold
            if confidence >= CONFIDENCE_THRESHOLD:
                # Parse label format (e.g., "Apple - Apple scab")
                crop = None
                disease = label
                
                if ' - ' in label:
                    parts = label.split(' - ', 1)
                    crop = parts[0].strip()
                    disease = parts[1].strip()
                elif '___' in label:
                    parts = label.split('___', 1)
                    crop = parts[0].replace('_', ' ').strip()
                    disease = parts[1].replace('_', ' ').strip()
                
                predictions.append({
                    'class_id': int(idx),
                    'label': label,
                    'crop': crop,
                    'disease': disease,
                    'confidence': confidence,
                    'confidence_percent': round(confidence * 100, 2)
                })
    
    # If expected crop provided, filter results
    if expected_crop and predictions:
        filtered = [p for p in predictions if p.get('crop', '').lower() == expected_crop.lower()]
        if filtered:
            predictions = filtered
    
    # Sort by confidence
    predictions.sort(key=lambda x: x['confidence'], reverse=True)
    
    # Get top prediction for main response
    top_prediction = predictions[0] if predictions else None
    
    # Map to frontend-expected format
    if top_prediction and top_prediction['confidence'] >= CONFIDENCE_THRESHOLD:
        predicted_class = top_prediction['label']
        disease_type = top_prediction['disease'] or 'Unknown'
        model_confidence = top_prediction['confidence']
        
        # Determine disease severity (0-1 scale)
        if disease_type.lower() == 'healthy':
            severity = 0.0
        elif model_confidence >= 0.7:
            severity = 0.8  # High severity
        elif model_confidence >= 0.5:
            severity = 0.5  # Medium severity
        else:
            severity = 0.2  # Low severity
        
        is_plant_detected = True
    else:
        predicted_class = 'Unknown'
        disease_type = 'Unclassified'
        model_confidence = 0.0
        severity = 0.0
        is_plant_detected = False
        if predictions:
            print(f"INFO: Top prediction confidence {predictions[0]['confidence']:.3f} below threshold {CONFIDENCE_THRESHOLD}", file=sys.stderr)
    
    # Main response format (matching frontend expectations)
    result = {
        'success': True,
        'predictedClass': predicted_class,
        'diseaseType': disease_type,
        'diseaseSeverity': severity,
        'modelConfidence': model_confidence,
        'isPlantDetected': model_confidence > CONFIDENCE_THRESHOLD,
        'rejectionReason': None if model_confidence > CONFIDENCE_THRESHOLD else 'Low confidence',
        'expectedCrop': expected_crop,
        'crop': top_prediction.get('crop') if top_prediction else None,
        'classId': top_prediction.get('class_id') if top_prediction else None,
        'predictions': predictions,
        'topPredictions': predictions[:TOP_K_RESULTS],
        'image_path': str(image_path),
        'model_classes': len(labels),
        'confidence_threshold': CONFIDENCE_THRESHOLD
    }
    
    return result


# ============================================================================
# Main
# ============================================================================
def main():
    parser = argparse.ArgumentParser(
        description='FarmTrust ML Model Inference',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  python infer.py --image test.jpg --model model.tflite --labels labels.json
  python infer.py --image test.jpg --model model.tflite --labels labels.json --expected_crop Apple
        '''
    )
    
    parser.add_argument('--image', required=True, help='Path to input image')
    parser.add_argument('--model', required=True, help='Path to TFLite model')
    parser.add_argument('--labels', required=True, help='Path to labels JSON file')
    parser.add_argument('--expected_crop', default=None, help='Expected crop type (optional filter)')
    parser.add_argument('--output', default=None, help='Output JSON file (prints to stdout if not specified)')
    
    args = parser.parse_args()
    
    # Validate files exist
    for file_path, name in [
        (args.image, 'image'),
        (args.model, 'model'),
        (args.labels, 'labels')
    ]:
        if not Path(file_path).exists():
            print(f"ERROR: {name.capitalize()} file not found: {file_path}", file=sys.stderr)
            sys.exit(1)
    
    try:
        # Load labels
        labels = load_labels(args.labels)
        
        if not labels:
            raise ValueError("No labels loaded")
        
        print(f"INFO: Loaded {len(labels)} classes from labels", file=sys.stderr)
        
        # Validate image quality first
        print(f"INFO: Validating image quality", file=sys.stderr)
        is_valid, quality_issues = validate_image_quality(args.image)
        
        if not is_valid:
            issue_text = "; ".join(quality_issues)
            print(f"INFO: Image failed quality check: {issue_text}", file=sys.stderr)
            error_result = {
                'success': True,
                'predictedClass': 'Non-Plant',
                'diseaseType': 'Invalid Input',
                'diseaseSeverity': 0.0,
                'modelConfidence': 0.0,
                'isPlantDetected': False,
                'rejectionReason': f"Image quality check failed: {issue_text}",
                'expectedCrop': args.expected_crop,
                'crop': None,
                'classId': None,
                'predictions': [],
                'topPredictions': [],
                'image_path': str(args.image),
                'model_classes': len(labels),
                'confidence_threshold': CONFIDENCE_THRESHOLD
            }
            print(json.dumps(error_result, indent=2))
            return 0
        
        # Run inference
        print(f"INFO: Running inference on {args.image}", file=sys.stderr)
        probabilities = run_inference(args.model, args.image, labels)
        
        # Format results
        results = format_results(
            probabilities,
            labels,
            expected_crop=args.expected_crop,
            image_path=args.image
        )
        
        # Output results
        output_json = json.dumps(results, indent=2)
        
        if args.output:
            with open(args.output, 'w') as f:
                f.write(output_json)
            print(f"INFO: Results saved to {args.output}", file=sys.stderr)
        else:
            print(output_json)
        
        return 0
    
    except Exception as e:
        error_result = {
            'success': False,
            'error': str(e),
            'error_type': type(e).__name__
        }
        print(json.dumps(error_result, indent=2))
        print(f"ERROR: {str(e)}", file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
