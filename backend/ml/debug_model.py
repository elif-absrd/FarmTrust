#!/usr/bin/env python3
"""
Diagnostic script to debug model output issues.
Helps identify why model is only predicting one class.
"""

import json
import os
import sys
import warnings
from pathlib import Path

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
warnings.filterwarnings("ignore")

try:
    import numpy as np
except ImportError:
    print("ERROR: numpy not installed")
    sys.exit(1)


def load_model_info():
    """Load metadata and labels"""
    ml_dir = Path(__file__).parent
    
    metadata_path = ml_dir / "model_metadata.json"
    labels_path = ml_dir / "labels.json"
    
    try:
        with open(metadata_path) as f:
            metadata = json.load(f)
        with open(labels_path) as f:
            labels = json.load(f)
        return metadata, labels
    except Exception as e:
        print(f"ERROR loading metadata/labels: {e}")
        sys.exit(1)


def load_interpreter():
    """Load TFLite interpreter"""
    ml_dir = Path(__file__).parent
    model_path = ml_dir / "disease_detection.tflite"
    
    if not model_path.exists():
        print(f"ERROR: Model file not found: {model_path}")
        sys.exit(1)
    
    try:
        from tflite_runtime.interpreter import Interpreter
        return Interpreter(model_path=str(model_path))
    except Exception:
        try:
            import tensorflow as tf
            return tf.lite.Interpreter(model_path=str(model_path))
        except Exception as e:
            print(f"ERROR loading interpreter: {e}")
            sys.exit(1)


def check_model_structure():
    """Check model input/output structure"""
    print("\n=== MODEL STRUCTURE ANALYSIS ===\n")
    
    interpreter = load_interpreter()
    interpreter.allocate_tensors()
    
    input_details = interpreter.get_input_details()[0]
    output_details = interpreter.get_output_details()[0]
    
    print(f"Input shape: {input_details['shape']}")
    print(f"Input dtype: {input_details['dtype']}")
    print(f"Input name: {input_details['name']}")
    
    print(f"\nOutput shape: {output_details['shape']}")
    print(f"Output dtype: {output_details['dtype']}")
    print(f"Output name: {output_details['name']}")
    
    output_size = np.prod(output_details['shape'])
    print(f"\nOutput total elements: {output_size}")
    print(f"Expected classes: 38")
    
    if output_size != 38:
        print(f"\n⚠️  WARNING: Output size ({output_size}) doesn't match expected classes (38)")
        return False
    
    return True


def test_inference_with_dummy():
    """Test inference with dummy data"""
    print("\n=== DUMMY DATA INFERENCE TEST ===\n")
    
    metadata, labels = load_model_info()
    interpreter = load_interpreter()
    interpreter.allocate_tensors()
    
    input_details = interpreter.get_input_details()[0]
    output_details = interpreter.get_output_details()[0]
    
    # Create dummy input
    input_shape = input_details['shape']
    input_dtype = input_details['dtype']
    
    # Test 1: All zeros
    print("Test 1: All zeros input")
    zeros_input = np.zeros(input_shape, dtype=input_dtype)
    interpreter.set_tensor(input_details["index"], zeros_input)
    interpreter.invoke()
    output = interpreter.get_tensor(output_details["index"]).astype(np.float32).squeeze()
    print(f"  Output shape: {output.shape}")
    print(f"  Output dtype: {output.dtype}")
    print(f"  Min: {np.min(output):.6f}, Max: {np.max(output):.6f}, Mean: {np.mean(output):.6f}")
    print(f"  Top 3 indices: {np.argsort(output)[::-1][:3]}")
    print(f"  Top 3 values: {output[np.argsort(output)[::-1][:3]]}")
    
    # Test 2: Random noise
    print("\nTest 2: Random noise input")
    noise_input = np.random.randn(*input_shape).astype(input_dtype)
    interpreter.set_tensor(input_details["index"], noise_input)
    interpreter.invoke()
    output = interpreter.get_tensor(output_details["index"]).astype(np.float32).squeeze()
    print(f"  Output shape: {output.shape}")
    print(f"  Min: {np.min(output):.6f}, Max: {np.max(output):.6f}, Mean: {np.mean(output):.6f}")
    print(f"  Std: {np.std(output):.6f}")
    print(f"  Top 3 indices: {np.argsort(output)[::-1][:3]}")
    print(f"  Top 3 values: {output[np.argsort(output)[::-1][:3]]}")
    
    # Test 3: Check for constant output
    print("\nTest 3: Checking for constant/collapsed outputs")
    all_same = np.allclose(output, output[0])
    print(f"  All values same: {all_same}")
    unique_values = len(np.unique(np.round(output, 6)))
    print(f"  Unique values (rounded to 6 decimals): {unique_values}")
    
    if unique_values <= 2:
        print("  ⚠️  WARNING: Model output is highly collapsed (constant or near-constant)")
        return False
    
    return True


def check_probability_distribution(labels):
    """Check probability distribution across all classes"""
    print("\n=== PROBABILITY DISTRIBUTION ===\n")
    
    interpreter = load_interpreter()
    interpreter.allocate_tensors()
    
    input_details = interpreter.get_input_details()[0]
    output_details = interpreter.get_output_details()[0]
    
    # Create random input
    input_shape = input_details['shape']
    input_dtype = input_details['dtype']
    test_input = np.random.randn(*input_shape).astype(input_dtype)
    
    interpreter.set_tensor(input_details["index"], test_input)
    interpreter.invoke()
    raw_output = interpreter.get_tensor(output_details["index"]).astype(np.float32).squeeze()
    
    # Apply softmax
    shifted = raw_output - np.max(raw_output)
    probabilities = np.exp(shifted) / np.sum(np.exp(shifted))
    
    print(f"Raw output stats:")
    print(f"  Min: {np.min(raw_output):.6f}")
    print(f"  Max: {np.max(raw_output):.6f}")
    print(f"  Mean: {np.mean(raw_output):.6f}")
    print(f"  Std: {np.std(raw_output):.6f}")
    
    print(f"\nProbability stats after softmax:")
    print(f"  Min: {np.min(probabilities):.6f}")
    print(f"  Max: {np.max(probabilities):.6f}")
    print(f"  Mean: {np.mean(probabilities):.6f}")
    print(f"  Sum: {np.sum(probabilities):.6f}")
    
    # Top predictions
    print(f"\nTop 10 predictions:")
    top_indices = np.argsort(probabilities)[::-1][:10]
    for i, idx in enumerate(top_indices, 1):
        label = labels[idx].get('display', labels[idx].get('raw', str(idx)))
        print(f"  {i}. {label}: {probabilities[idx]:.6f}")
    
    # Check if one class dominates
    max_prob = np.max(probabilities)
    print(f"\nMax probability: {max_prob:.6f}")
    if max_prob > 0.95:
        print("  ⚠️  WARNING: One class is dominating (>95% probability)")
        return False
    
    return True


def main():
    print("=" * 60)
    print("FarmTrust ML Model Diagnostic Tool")
    print("=" * 60)
    
    metadata, labels = load_model_info()
    
    print(f"\nModel: {metadata.get('modelName')} v{metadata.get('modelVersion')}")
    print(f"Classes: {len(labels)}")
    print(f"Dataset: {metadata.get('dataset')}")
    
    # Run diagnostics
    tests = [
        ("Model Structure Check", check_model_structure),
        ("Dummy Inference Test", test_inference_with_dummy),
        ("Probability Distribution", lambda: check_probability_distribution(labels)),
    ]
    
    results = {}
    for test_name, test_func in tests:
        try:
            results[test_name] = test_func()
        except Exception as e:
            print(f"\nERROR in {test_name}: {e}")
            import traceback
            traceback.print_exc()
            results[test_name] = False
    
    # Summary
    print("\n" + "=" * 60)
    print("DIAGNOSTIC SUMMARY")
    print("=" * 60)
    
    all_pass = all(results.values())
    for test_name, result in results.items():
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"{status}: {test_name}")
    
    if not all_pass:
        print("\n⚠️  ISSUES DETECTED:")
        if not results["Model Structure Check"]:
            print("  - Model output doesn't have 38 classes - RETRAIN REQUIRED")
        if not results["Dummy Inference Test"]:
            print("  - Model output is constant or collapsed - MODEL LIKELY CORRUPTED")
        if not results["Probability Distribution"]:
            print("  - One class dominates - MODEL BIAS or CORRUPTION")
    else:
        print("\n✓ Model structure appears healthy")
        print("  Issue may be in preprocessing or data pipeline")
    
    print("=" * 60)
    sys.exit(0 if all_pass else 1)


if __name__ == "__main__":
    main()
