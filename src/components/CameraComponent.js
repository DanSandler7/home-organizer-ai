import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Image } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

/**
 * Reusable Camera Component
 * Handles Android permissions and captures temporary image URIs
 * 
 * Props:
 * - onCapture: (imageUri: string) => void - callback when photo is taken
 * - onCancel: () => void - callback when user cancels
 */
export default function CameraComponent({ onCapture, onCancel }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedImage, setCapturedImage] = useState(null);
  const [zoom, setZoom] = useState(0);
  const cameraRef = useRef(null);
  
  // Zoom range: 0 (1x, no zoom) to 1 (max zoom)

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Loading camera permissions...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Camera permission required</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onCancel}>
          <Text style={styles.buttonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const takePicture = async () => {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.3,
        base64: false,
        exif: false,
        skipProcessing: false,
      });
      console.log('[CameraComponent] Photo captured:', photo.uri);
      setCapturedImage(photo.uri);
    } catch (error) {
      Alert.alert('Error', 'Failed to capture image: ' + error.message);
    }
  };

  const confirmImage = () => {
    if (capturedImage) {
      onCapture(capturedImage);
      setCapturedImage(null);
    }
  };

  const retakePicture = () => {
    setCapturedImage(null);
  };

  const zoomIn = () => {
    setZoom(prev => Math.min(prev + 0.1, 1));
  };

  const zoomOut = () => {
    setZoom(prev => Math.max(prev - 0.1, 0));
  };

  // Preview captured image
  if (capturedImage) {
    return (
      <View style={styles.container}>
        <Image source={{ uri: capturedImage }} style={styles.preview} />
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={retakePicture}>
            <Text style={styles.buttonText}>Retake</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={confirmImage}>
            <Text style={styles.buttonText}>Use Photo</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Camera view
  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} ref={cameraRef} mode="picture" zoom={zoom}>
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.cancelOverlay} onPress={onCancel}>
            <Text style={styles.cancelText}>✕ Cancel</Text>
          </TouchableOpacity>
        </View>
        
        {/* Zoom Controls - 0 to 1 range = 1x to 2x zoom */}
        <View style={styles.zoomContainer}>
          <TouchableOpacity style={styles.zoomButton} onPress={zoomOut}>
            <Text style={styles.zoomText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.zoomLevel}>{(1 + zoom).toFixed(1)}x</Text>
          <TouchableOpacity style={styles.zoomButton} onPress={zoomIn}>
            <Text style={styles.zoomText}>+</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.captureContainer}>
          <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 40,
    left: 20,
    zIndex: 10,
  },
  cancelOverlay: {
    padding: 10,
  },
  cancelText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  captureContainer: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
  },
  zoomContainer: {
    position: 'absolute',
    bottom: 130,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 25,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  zoomButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  zoomLevel: {
    color: '#fff',
    fontSize: 14,
    marginHorizontal: 15,
    minWidth: 40,
    textAlign: 'center',
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#ccc',
  },
  captureButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
  },
  preview: {
    flex: 1,
    resizeMode: 'cover',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    backgroundColor: '#000',
  },
  button: {
    backgroundColor: '#4A90D9',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#666',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  message: {
    textAlign: 'center',
    padding: 20,
    color: '#333',
  },
});
