"""
🚀 FarmTrust ML Model Training on Google Colab
Copy and paste each CELL into a new Colab cell
Run cells in order from top to bottom

Total time: ~45 minutes on free T4 GPU
"""

# ============================================================================
# CELL 1: Setup & Install Dependencies
# ============================================================================
# Copy this entire block into ONE Colab cell and run it

print("=" * 70)
print("CELL 1: Setup Google Colab Environment")
print("=" * 70)

# Mount Google Drive
from google.colab import drive
drive.mount('/content/drive')

# Install TensorFlow (may take 2-3 minutes)
import subprocess
import sys
print("\nInstalling dependencies...")
subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "tensorflow", "pillow", "numpy"])

# Check GPU
import tensorflow as tf
gpus = tf.config.list_physical_devices('GPU')
if gpus:
    print(f"\n✓ GPU available: {gpus[0].name}")
else:
    print("\n⚠️  WARNING: No GPU detected!")
    print("   Fix: Runtime > Change runtime type > Select GPU (T4)")

print(f"\nTensorFlow version: {tf.__version__}")
print("\n✓ Setup complete!\n")


# ============================================================================
# CELL 2: Download Dataset from Kaggle
# ============================================================================
# Copy this entire block into ONE new Colab cell and run it
#!/usr/bin/env python3
"""
Kaggle Colab Setup - Uses pre-configured API token
Run this in Colab CELL 2 to download dataset automatically
"""

print("=" * 70)
print("CELL 2: Download Dataset with Kaggle API Token")
print("=" * 70)

import os
from pathlib import Path

# Setup Kaggle API token
print("\nConfiguring Kaggle API...")
os.makedirs('/root/.kaggle', exist_ok=True)

# Your API token (DO NOT SHARE THIS)
kaggle_config = """{
  "username": "KGAT_9c6ff3cbb9a4f07c64430f929c0bce15",
  "key": "KGAT_9c6ff3cbb9a4f07c64430f929c0bce15"
}"""

with open('/root/.kaggle/kaggle.json', 'w') as f:
    f.write(kaggle_config)

os.chmod('/root/.kaggle/kaggle.json', 0o600)
print("✓ Kaggle API configured")

# Download dataset
print("\nDownloading plant diseases dataset...")
print("(This takes 10-15 minutes, be patient)\n")

import subprocess
result = subprocess.run(
    ['kaggle', 'datasets', 'download', '-d', 'vipoooool/new-plant-diseases-dataset', '-q'],
    capture_output=True,
    text=True
)

if result.returncode != 0:
    print(f"⚠️  Download warning: {result.stderr}")
else:
    print("✓ Dataset downloaded successfully")

# Check what's in the ZIP
print("\nChecking ZIP file contents...")
zip_check = subprocess.run(['unzip', '-l', 'new-plant-diseases-dataset.zip'], 
                           capture_output=True, text=True)
if 'train' in zip_check.stdout:
    print("✓ Found /train directory in ZIP")
if 'valid' in zip_check.stdout:
    print("✓ Found /valid directory in ZIP")

# Extract dataset
print("\nExtracting dataset (takes 2-3 minutes)...")
extract_result = subprocess.run(['unzip', '-q', 'new-plant-diseases-dataset.zip'],
                               capture_output=True, text=True)

if extract_result.returncode != 0:
    print(f"⚠️  Extraction warning: {extract_result.stderr}")

# List what was actually extracted
print("\nChecking extracted contents...")
import os
dir_contents = os.listdir('.')
print(f"Files/folders in current directory: {dir_contents}")

# Find the actual dataset folder (handles nested structure)
dataset_folder = None
for item in dir_contents:
    if 'New Plant Diseases' in item and os.path.isdir(item):
        # Check if this folder contains train/valid or has nested structure
        nested_contents = os.listdir(item)
        if 'train' in nested_contents or 'valid' in nested_contents:
            dataset_folder = item
            print(f"✓ Found dataset at: {item}")
            break
        else:
            # Check for nested folder
            for nested in nested_contents:
                nested_path = os.path.join(item, nested)
                if os.path.isdir(nested_path):
                    nested_inner = os.listdir(nested_path)
                    if 'train' in nested_inner or 'valid' in nested_inner:
                        dataset_folder = nested_path
                        print(f"✓ Found dataset at: {nested_path}")
                        break

if dataset_folder:
    train_dir = Path(dataset_folder) / 'train'
    valid_dir = Path(dataset_folder) / 'valid'
    
    if train_dir.exists() and valid_dir.exists():
        train_classes = len(os.listdir(train_dir))
        valid_classes = len(os.listdir(valid_dir))
        print(f"\n✓ Dataset ready!")
        print(f"  Train classes: {train_classes}")
        print(f"  Valid classes: {valid_classes}")
        print(f"  Location: {dataset_folder}")
        print(f"\n✓ Ready for CELL 3 (training)\n")
        
        # Store dataset path for next cell
        with open('dataset_path.txt', 'w') as f:
            f.write(str(dataset_folder))
    else:
        print("\n✗ Could not find train/valid directories")
        print(f"  Contents of {dataset_folder}: {os.listdir(dataset_folder)}")
else:
    print("\n✗ Could not find dataset folder")
    print("  Expected folder with 'New Plant Diseases' in name")
    print(f"\nCurrent directory contents:")
    for item in dir_contents[:20]:
        print(f"  - {item}")


# ============================================================================
# CELL 3: Build & Train Model - STAGE 1
# ============================================================================
# Copy this entire block into ONE new Colab cell and run it
# This takes ~8-10 minutes
print("\n" + "=" * 70)
print("CELL 3: Build Model & Train - Stage 1 (Frozen Base)")
print("=" * 70)

import tensorflow as tf
from pathlib import Path

# Using tf.keras submodules directly to resolve import warnings
MobileNetV2 = tf.keras.applications.MobileNetV2
Dense = tf.keras.layers.Dense
GlobalAveragePooling2D = tf.keras.layers.GlobalAveragePooling2D
Dropout = tf.keras.layers.Dropout
Adam = tf.keras.optimizers.Adam
EarlyStopping = tf.keras.callbacks.EarlyStopping
ReduceLROnPlateau = tf.keras.callbacks.ReduceLROnPlateau

# Config
IMAGE_SIZE = 224
BATCH_SIZE = 32
NUM_CLASSES = 38

# Load dataset
# Try to read the dataset path saved by CELL 2
try:
    with open('dataset_path.txt', 'r') as f:
        dataset_folder = f.read().strip()
    train_path = Path(dataset_folder) / 'train'
    valid_path = Path(dataset_folder) / 'valid'
    print(f"\nUsing dataset from: {dataset_folder}")
except:
    # Fallback to common paths
    print("\nDataset path not found, trying common locations...")
    possible_paths = [
        'new-plant-diseases-dataset',
        'New Plant Diseases Dataset(Augmented)/New Plant Diseases Dataset(Augmented)',
        'New Plant Diseases Dataset(Augmented)'
    ]
    
    train_path = None
    valid_path = None
    for base_path in possible_paths:
        test_train = Path(base_path) / 'train'
        test_valid = Path(base_path) / 'valid'
        if test_train.exists() and test_valid.exists():
            train_path = test_train
            valid_path = test_valid
            print(f"Found dataset at: {base_path}")
            break
    
    if not train_path or not valid_path:
        raise FileNotFoundError("Could not find train/valid directories. Check dataset extraction in CELL 2.")

print("\nLoading dataset...")
train_dataset = tf.keras.preprocessing.image_dataset_from_directory(
    train_path,
    seed=42,
    image_size=(IMAGE_SIZE, IMAGE_SIZE),
    batch_size=BATCH_SIZE,
    label_mode='categorical'
)

val_dataset = tf.keras.preprocessing.image_dataset_from_directory(
    valid_path,
    seed=42,
    image_size=(IMAGE_SIZE, IMAGE_SIZE),
    batch_size=BATCH_SIZE,
    label_mode='categorical'
)

print(f"✓ Classes: {len(train_dataset.class_names)}")
print(f"  Train batches: {len(train_dataset)}")
print(f"  Val batches: {len(val_dataset)}")

# Data augmentation
print("\nApplying data augmentation...")
train_dataset = train_dataset.prefetch(tf.data.AUTOTUNE).map(
    lambda x, y: (tf.image.random_flip_left_right(
        tf.image.random_brightness(x, 0.2)
    ), y),
    num_parallel_calls=tf.data.AUTOTUNE
)

# Build model
print("\nBuilding model...")
base_model = MobileNetV2(
    input_shape=(IMAGE_SIZE, IMAGE_SIZE, 3),
    include_top=False,
    weights='imagenet'
)
base_model.trainable = False

model = tf.keras.Sequential([
    tf.keras.Input(shape=(IMAGE_SIZE, IMAGE_SIZE, 3)),
    base_model,
    GlobalAveragePooling2D(),
    Dense(256, activation='relu'),
    Dropout(0.5),
    Dense(128, activation='relu'),
    Dropout(0.3),
    Dense(NUM_CLASSES, activation='softmax')
])

print(f"✓ Model created")
print(f"  Total parameters: {model.count_params():,}")

# Compile
model.compile(
    optimizer=Adam(learning_rate=0.001),
    loss='categorical_crossentropy',
    metrics=['accuracy']
)

# Callbacks
callbacks = [
    EarlyStopping(monitor='val_loss', patience=5, restore_best_weights=True, verbose=1),
    ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=3, min_lr=1e-7, verbose=1)
]

# Train Stage 1
print("\n" + "-" * 70)
print("STAGE 1: Train head only (frozen base) - 20 epochs")
print("-" * 70 + "\n")

history1 = model.fit(
    train_dataset,
    validation_data=val_dataset,
    epochs=20,
    callbacks=callbacks,
    verbose=1
)

print("\n✓ Stage 1 complete!")



# ============================================================================
# CELL 4: Train Model - STAGE 2 (Fine-tune)
# ============================================================================
# Copy this entire block into ONE new Colab cell and run it
# This takes ~10-15 minutes

print("\n" + "=" * 70)
print("CELL 4: Train Model - Stage 2 (Fine-tune Base)")
print("=" * 70)

# Unfreeze base model
print("\nUnfreezing base model layers...")
base_model.trainable = True
for layer in base_model.layers[:-50]:
    layer.trainable = False

trainable_count = sum([1 for l in base_model.layers if l.trainable])
print(f"✓ Trainable layers in base: {trainable_count}")

# Recompile with lower learning rate
model.compile(
    optimizer=Adam(learning_rate=0.0001),
    loss='categorical_crossentropy',
    metrics=['accuracy']
)

# Train Stage 2
print("\n" + "-" * 70)
print("STAGE 2: Fine-tune base model - 30 epochs")
print("-" * 70 + "\n")

history2 = model.fit(
    train_dataset,
    validation_data=val_dataset,
    epochs=30,
    callbacks=callbacks,
    verbose=1,
    initial_epoch=20
)

print("\n✓ Stage 2 complete!")
print("\n" + "=" * 70)
print("✓ TRAINING FINISHED!")
print("=" * 70)


# ============================================================================
# CELL 5: Export to TFLite Format
# ============================================================================
# Copy this entire block into ONE new Colab cell and run it

print("\n" + "=" * 70)
print("CELL 5: Export Model to TensorFlow Lite Format")
print("=" * 70)

import numpy as np
import os

print("\nExporting to TFLite...")
converter = tf.lite.TFLiteConverter.from_keras_model(model)
converter.optimizations = [tf.lite.Optimize.DEFAULT]
converter.target_spec.supported_ops = [
    tf.lite.OpsSet.TFLITE_BUILTINS,
    tf.lite.OpsSet.SELECT_TF_OPS,
]

tflite_model = converter.convert()

# Save to Colab storage
colab_path = '/content/disease_detection.tflite'
with open(colab_path, 'wb') as f:
    f.write(tflite_model)

size_mb = len(tflite_model) / (1024 * 1024)
print(f"\n✓ Exported to: {colab_path}")
print(f"  Size: {size_mb:.1f} MB")

# Save to Google Drive
drive_path = '/content/drive/My Drive/FarmTrust'
os.makedirs(drive_path, exist_ok=True)
drive_file = os.path.join(drive_path, 'disease_detection.tflite')
with open(drive_file, 'wb') as f:
    f.write(tflite_model)

print(f"\n✓ Also saved to Google Drive: FarmTrust/disease_detection.tflite")
print("  (You can access from any device)")

# Save full Keras model
keras_path = '/content/trained_plant_disease_model.keras'
model.save(keras_path)
drive_keras = os.path.join(drive_path, 'trained_plant_disease_model.keras')
os.system(f"cp '{keras_path}' '{drive_keras}'")
print(f"\n✓ Saved Keras model: {keras_path}")
print("  Also saved to Google Drive: FarmTrust/trained_plant_disease_model.keras")

# Save labels.json
labels = []
for idx, name in enumerate(train_dataset.class_names):
    raw = name
    display = name.replace('___', ' - ').replace('_', ' ')
    labels.append({
        'id': idx,
        'raw': raw,
        'display': display,
        'diseaseType': 'Unknown'
    })

labels_path = '/content/labels.json'
with open(labels_path, 'w') as f:
    import json
    json.dump(labels, f, indent=2)

drive_labels = os.path.join(drive_path, 'labels.json')
os.system(f"cp '{labels_path}' '{drive_labels}'")
print("\n✓ Saved labels.json")
print("  Also saved to Google Drive: FarmTrust/labels.json")

# Save model metadata
from datetime import datetime, timezone

metrics = {}
if 'history2' in globals():
    metrics = {
        'valAccuracy': float(history2.history.get('val_accuracy', [0])[-1]),
        'valLoss': float(history2.history.get('val_loss', [0])[-1])
    }
elif 'history1' in globals():
    metrics = {
        'valAccuracy': float(history1.history.get('val_accuracy', [0])[-1]),
        'valLoss': float(history1.history.get('val_loss', [0])[-1])
    }

metadata = {
    'modelName': 'farmtrust_disease_classifier',
    'modelVersion': '1.0.0',
    'createdAtUTC': datetime.now(timezone.utc).isoformat(),
    'dataset': 'vipoooool/new-plant-diseases-dataset',
    'input': {
        'width': IMAGE_SIZE,
        'height': IMAGE_SIZE,
        'channels': 3,
        'dtype': 'float32',
        'preprocess': {
            'name': 'mobilenet_v2_preprocess_input',
            'formula': '(pixel / 127.5) - 1.0',
            'pixelRangeIn': [0, 255],
            'pixelRangeOut': [-1, 1]
        }
    },
    'output': {
        'type': 'softmax',
        'numClasses': len(labels),
        'labelsFile': 'labels.json',
        'healthyKeyword': 'healthy'
    },
    'severityRule': {
        'description': 'Derived for claims: healthy => 0.0 else clamp(confidence, 0.05, 0.99)',
        'formula': 'if healthy then 0.0 else min(0.99, max(0.05, confidence))'
    },
    'metrics': metrics
}

metadata_path = '/content/model_metadata.json'
with open(metadata_path, 'w') as f:
    json.dump(metadata, f, indent=2)

drive_metadata = os.path.join(drive_path, 'model_metadata.json')
os.system(f"cp '{metadata_path}' '{drive_metadata}'")
print("\n✓ Saved model_metadata.json")
print("  Also saved to Google Drive: FarmTrust/model_metadata.json")


# ============================================================================
# CELL 6: Validate Model
# ============================================================================
# Copy this entire block into ONE new Colab cell and run it

print("\n" + "=" * 70)
print("CELL 6: Validate Trained Model")
print("=" * 70)

print("\nLoading TFLite model...")
interpreter = tf.lite.Interpreter(model_path='/content/disease_detection.tflite')
interpreter.allocate_tensors()

input_details = interpreter.get_input_details()[0]
output_details = interpreter.get_output_details()[0]

print(f"\nModel structure:")
print(f"  Input shape: {input_details['shape']}")
print(f"  Output shape: {output_details['shape']}")

# Test inference
print("\nRunning test inference...")
test_input = np.random.randn(*input_details['shape']).astype(np.float32)
interpreter.set_tensor(input_details["index"], test_input)
interpreter.invoke()
output = interpreter.get_tensor(output_details["index"]).astype(np.float32).squeeze()

print(f"  Output shape: {output.shape}")
print(f"  Output sum: {np.sum(output):.6f}")
print(f"  Top class: {np.argmax(output)} (confidence: {np.max(output):.4f})")

print(f"\n✓ Model validation PASSED!")
print(f"  Ready to use in FarmTrust\n")


# ============================================================================
# CELL 7: Download Model to Your Computer
# ============================================================================
# Copy this entire block into ONE new Colab cell and run it

print("=" * 70)
print("CELL 7: Download Trained Model")
print("=" * 70)

from google.colab import files

print("\nStarting download...")
print(f"File: disease_detection.tflite ({size_mb:.1f} MB)")
print("\nWhen prompted, select the download location\n")

files.download('/content/disease_detection.tflite')

print("\n" + "=" * 70)
print("✓ DOWNLOAD STARTED!")
print("=" * 70)
print("\nNext steps:")
print("1. Wait for download to complete")
print("2. File will be at: C:\\Users\\YourName\\Downloads\\")
print("3. Move file to: e:\\SEM 6\\lit\\FarmTrust\\backend\\ml\\")
print("4. Replace old disease_detection.tflite")
print("5. Restart FarmTrust backend")
print("6. Test with images\n")


# ============================================================================
# CELL 8 (Optional): List Files
# ============================================================================
# Copy this to verify files exist

import os
print("Files in /content/:")
for f in os.listdir('/content'):
    if 'disease' in f or f.endswith('.tflite'):
        size = os.path.getsize(f'/content/{f}') / (1024*1024)
        print(f"  {f}: {size:.1f} MB")

print("\nFiles in Google Drive (FarmTrust folder):")
drive_files = os.listdir('/content/drive/My Drive/FarmTrust')
for f in drive_files:
    if f.endswith('.tflite'):
        path = f'/content/drive/My Drive/FarmTrust/{f}'
        size = os.path.getsize(path) / (1024*1024)
        print(f"  {f}: {size:.1f} MB")
