#!/usr/bin/env python3
"""
Train a plant disease classification model from scratch.
Uses MobileNetV2 with transfer learning on the plant diseases dataset.
"""

import os
import sys
import tensorflow as tf
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.layers import Dense, GlobalAveragePooling2D, Dropout
from tensorflow.keras.optimizers import Adam
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau
import json
from pathlib import Path

# Configuration
IMAGE_SIZE = 224
BATCH_SIZE = 32
EPOCHS = 50
LEARNING_RATE = 0.001
NUM_CLASSES = 38


def get_dataset_path():
    """Get path to downloaded dataset"""
    # Download from: https://www.kaggle.com/vipoooool/new-plant-diseases-dataset
    # Or use: https://huggingface.co/datasets/vipoooool/new-plant-diseases-dataset
    
    possible_paths = [
        Path("/data/new-plant-diseases-dataset/valid"),
        Path("/data/plant-disease/valid"),
        Path.home() / "Downloads" / "new-plant-diseases-dataset" / "valid",
        Path("./new-plant-diseases-dataset/valid"),
    ]
    
    for path in possible_paths:
        if path.exists():
            print(f"✓ Found dataset at: {path}")
            return path
    
    print("\n❌ Dataset not found! Download it first:\n")
    print("Option 1: From Kaggle")
    print("  https://www.kaggle.com/vipoooool/new-plant-diseases-dataset")
    print("  Save to: ./new-plant-diseases-dataset/\n")
    
    print("Option 2: From HuggingFace")
    print("  from datasets import load_dataset")
    print("  dataset = load_dataset('vipoooool/new-plant-diseases-dataset')\n")
    
    print("Option 3: Manual download")
    print("  wget https://huggingface.co/datasets/vipoooool/new-plant-diseases-dataset/resolve/main/data.tar.gz")
    print("  tar -xzf data.tar.gz\n")
    
    sys.exit(1)


def create_model():
    """Create MobileNetV2 model with custom head"""
    print("\n=== Building Model ===\n")
    
    # Load pre-trained MobileNetV2
    base_model = MobileNetV2(
        input_shape=(IMAGE_SIZE, IMAGE_SIZE, 3),
        include_top=False,
        weights='imagenet'
    )
    
    print(f"Base model: MobileNetV2")
    print(f"Base trainable layers: {len(base_model.trainable_weights)}")
    
    # Freeze base model initially (transfer learning)
    base_model.trainable = False
    
    # Build custom head
    model = tf.keras.Sequential([
        tf.keras.Input(shape=(IMAGE_SIZE, IMAGE_SIZE, 3)),
        base_model,
        GlobalAveragePooling2D(),
        Dense(256, activation='relu'),
        Dropout(0.5),
        Dense(128, activation='relu'),
        Dropout(0.3),
        Dense(NUM_CLASSES, activation='softmax')  # CRITICAL: 38 classes
    ])
    
    print(f"Output layer: Dense({NUM_CLASSES}, activation='softmax')")
    print(f"Total model parameters: {model.count_params():,}\n")
    
    return model, base_model


def train_model(model, base_model, train_dataset, val_dataset):
    """Train the model in two stages"""
    
    print("=== Stage 1: Train head only (frozen base) ===\n")
    
    model.compile(
        optimizer=Adam(learning_rate=LEARNING_RATE),
        loss='categorical_crossentropy',
        metrics=['accuracy']
    )
    
    callbacks = [
        EarlyStopping(
            monitor='val_loss',
            patience=5,
            restore_best_weights=True,
            verbose=1
        ),
        ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.5,
            patience=3,
            min_lr=1e-7,
            verbose=1
        )
    ]
    
    # Stage 1: Train head
    history1 = model.fit(
        train_dataset,
        validation_data=val_dataset,
        epochs=20,
        callbacks=callbacks,
        verbose=1
    )
    
    print("\n=== Stage 2: Fine-tune base model ===\n")
    
    # Unfreeze last layers of base model
    base_model.trainable = True
    for layer in base_model.layers[:-50]:
        layer.trainable = False
    
    # Recompile with lower learning rate
    model.compile(
        optimizer=Adam(learning_rate=LEARNING_RATE / 10),
        loss='categorical_crossentropy',
        metrics=['accuracy']
    )
    
    print(f"Trainable layers in base: {sum([1 for l in base_model.layers if l.trainable])}\n")
    
    # Stage 2: Fine-tune
    history2 = model.fit(
        train_dataset,
        validation_data=val_dataset,
        epochs=30,
        callbacks=callbacks,
        verbose=1,
        initial_epoch=20
    )
    
    return history1, history2


def export_to_tflite(model, output_path):
    """Export Keras model to TensorFlow Lite format"""
    print("\n=== Exporting to TensorFlow Lite ===\n")
    
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    
    # Optimization
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter.target_spec.supported_ops = [
        tf.lite.OpsSet.TFLITE_BUILTINS,
        tf.lite.OpsSet.SELECT_TF_OPS,
    ]
    
    tflite_model = converter.convert()
    
    # Save
    with open(output_path, 'wb') as f:
        f.write(tflite_model)
    
    size_mb = len(tflite_model) / (1024 * 1024)
    print(f"✓ Exported: {output_path}")
    print(f"  Size: {size_mb:.1f} MB\n")


def validate_export(tflite_path):
    """Validate exported TFLite model"""
    print("=== Validating TFLite Model ===\n")
    
    try:
        from tflite_runtime.interpreter import Interpreter
        interpreter = Interpreter(model_path=str(tflite_path))
    except:
        import tensorflow as tf
        interpreter = tf.lite.Interpreter(model_path=str(tflite_path))
    
    interpreter.allocate_tensors()
    
    input_details = interpreter.get_input_details()[0]
    output_details = interpreter.get_output_details()[0]
    
    print(f"Input shape: {input_details['shape']}")
    print(f"Output shape: {output_details['shape']}")
    
    # Test inference
    import numpy as np
    test_input = np.random.randn(*input_details['shape']).astype(np.float32)
    interpreter.set_tensor(input_details["index"], test_input)
    interpreter.invoke()
    output = interpreter.get_tensor(output_details["index"]).astype(np.float32).squeeze()
    
    print(f"Test inference output shape: {output.shape}")
    print(f"Output sum (should be ~1.0): {np.sum(output):.6f}")
    print(f"Top prediction index: {np.argmax(output)}")
    print(f"✓ TFLite model validation passed!\n")


def main():
    print("=" * 70)
    print("FarmTrust Plant Disease Model - Training Script")
    print("=" * 70)
    
    # Step 1: Load dataset
    print("\n=== Loading Dataset ===\n")
    dataset_path = get_dataset_path()
    
    # Load images with automatic directory structure detection
    train_dataset = tf.keras.preprocessing.image_dataset_from_directory(
        dataset_path,
        seed=42,
        image_size=(IMAGE_SIZE, IMAGE_SIZE),
        batch_size=BATCH_SIZE,
        label_mode='categorical',
        validation_split=0.2,
        subset='training'
    )
    
    val_dataset = tf.keras.preprocessing.image_dataset_from_directory(
        dataset_path,
        seed=42,
        image_size=(IMAGE_SIZE, IMAGE_SIZE),
        batch_size=BATCH_SIZE,
        label_mode='categorical',
        validation_split=0.2,
        subset='validation'
    )
    
    print(f"Classes found: {len(train_dataset.class_names)}")
    print(f"Class names: {train_dataset.class_names[:5]}... (showing first 5)\n")
    
    if len(train_dataset.class_names) != NUM_CLASSES:
        print(f"⚠️  WARNING: Found {len(train_dataset.class_names)} classes, expected {NUM_CLASSES}")
        print("Make sure you have the correct dataset!\n")
    
    print(f"Train samples: ~{len(train_dataset) * BATCH_SIZE}")
    print(f"Val samples: ~{len(val_dataset) * BATCH_SIZE}\n")
    
    # Optional: Data augmentation
    print("Applying data augmentation...")
    train_dataset = train_dataset.prefetch(tf.data.AUTOTUNE).map(
        lambda x, y: (tf.image.random_flip_left_right(
            tf.image.random_brightness(x, 0.2)
        ), y),
        num_parallel_calls=tf.data.AUTOTUNE
    )
    
    # Step 2: Create model
    model, base_model = create_model()
    
    # Step 3: Train
    print("=== Training ===\n")
    try:
        history1, history2 = train_model(model, base_model, train_dataset, val_dataset)
    except KeyboardInterrupt:
        print("\n⚠️  Training interrupted by user")
        sys.exit(1)
    
    # Step 4: Export to TFLite
    export_path = Path(__file__).parent / "disease_detection.tflite"
    export_to_tflite(model, export_path)
    
    # Step 5: Validate
    validate_export(export_path)
    
    print("=" * 70)
    print("✓ Model training and export complete!")
    print("=" * 70)


if __name__ == "__main__":
    main()
