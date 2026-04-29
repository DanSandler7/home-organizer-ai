import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
  FlatList,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CameraComponent from '../components/CameraComponent';
import { analyzeItem, getImportanceQuestions, calculateImportanceScore, getSmartSuggestion } from '../services/aiService';
import { 
  saveItem, 
  getAllSpaces, 
  saveSpace, 
  saveImagePermanently,
  checkUserAITier,
  recordAIAnalysis,
  activateAIPackage,
  getAllSpacesHierarchical,
  getGuidesForPrompt,
} from '../services/dbService';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

// Stable device ID for this app session (persists across component re-renders)
const DEVICE_ID = 'device-' + Math.random().toString(36).substring(2, 15);

/**
 * Organize Screen - "Organize Item"
 * Full implementation: AI analysis, space assignment, item saving
 */
export default function OrganizeScreen() {
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [spaces, setSpaces] = useState([]);
  const [showSpaceSelector, setShowSpaceSelector] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCreateSpaceModal, setShowCreateSpaceModal] = useState(false);
  const [newMacroSpace, setNewMacroSpace] = useState('');
  const [newMicroZone, setNewMicroZone] = useState('');
  const [locationDescription, setLocationDescription] = useState('');
  
  // User tier and AI usage state
  const [userTier, setUserTier] = useState({ hasAIPackage: false, analysesToday: 0, analysesRemaining: 0, tier: 'base' });
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [pendingImageUri, setPendingImageUri] = useState(null);
  const [itemSaved, setItemSaved] = useState(false);
  
  // Importance ranking state
  const [showImportanceQuestions, setShowImportanceQuestions] = useState(false);
  const [importanceQuestions, setImportanceQuestions] = useState(null);
  const [importanceAnswers, setImportanceAnswers] = useState({});
  const [importanceScore, setImportanceScore] = useState(null);
  
  // Edit AI result state
  const [showEditAIResult, setShowEditAIResult] = useState(false);
  const [editItemName, setEditItemName] = useState('');
  const [editTags, setEditTags] = useState('');
  const [isReanalyzing, setIsReanalyzing] = useState(false);

  // Smart suggestion state
  const [smartSuggestion, setSmartSuggestion] = useState(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [allSpacesFlat, setAllSpacesFlat] = useState([]);

  // Load spaces when component mounts
  useEffect(() => {
    loadSpaces();
    loadUserTier();
  }, []);

  const loadSpaces = async () => {
    try {
      const data = await getAllSpaces();
      setSpaces(data);
      // Also keep the flat hierarchical list for smart suggestions
      const flat = await getAllSpacesHierarchical();
      setAllSpacesFlat(flat);
    } catch (error) {
      console.error('Failed to load spaces:', error);
    }
  };

  const fetchSmartSuggestion = async (result) => {
    try {
      setLoadingSuggestion(true);
      const guidesText = await getGuidesForPrompt();
      const suggestion = await getSmartSuggestion(result, allSpacesFlat, guidesText);
      setSmartSuggestion(suggestion);
    } catch (error) {
      console.error('[OrganizeScreen] Smart suggestion error:', error);
    } finally {
      setLoadingSuggestion(false);
    }
  };

  const loadUserTier = async () => {
    const tier = await checkUserAITier(DEVICE_ID);
    setUserTier(tier);
  };

  const handleCapture = async (uri, freshTier = null) => {
    // Use freshTier if provided (avoids stale state after activation), else use state
    const tier = freshTier || userTier;
    
    // Check AI package first
    if (!tier.hasAIPackage) {
      setShowCamera(false);
      setPendingImageUri(uri); // Save image so we can continue after upgrade
      setShowUpgradeModal(true);
      return;
    }
    
    // Check daily limit
    if (tier.analysesRemaining <= 0) {
      setShowCamera(false);
      Alert.alert(
        'Daily Limit Reached',
        'You have used all 10 AI analyses for today. Upgrade to premium for unlimited access.',
        [
          { text: 'Upgrade', onPress: () => setShowUpgradeModal(true) },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
      return;
    }
    
    setShowCamera(false);
    setAnalyzing(true);

    try {
      // FIRST: Save image to permanent storage immediately
      console.log('[OrganizeScreen] Saving image permanently...');
      const permanentUri = await saveImagePermanently(uri, 'item');
      console.log('[OrganizeScreen] Image saved to:', permanentUri);
      
      // Use permanent URI from now on
      setCapturedImage(permanentUri);
      
      // THEN: Analyze the image
      const result = await analyzeItem(permanentUri);
      
      // Record AI usage
      await recordAIAnalysis(DEVICE_ID);
      
      // Update local tier state
      setUserTier(prev => ({
        ...prev,
        analysesToday: prev.analysesToday + 1,
        analysesRemaining: prev.analysesRemaining - 1
      }));
      
      setAiResult(result);
      
      // Generate importance questions based on AI analysis
      const questions = getImportanceQuestions(result);
      setImportanceQuestions(questions);
      setImportanceAnswers({});
      setShowImportanceQuestions(true);

      // Fetch smart suggestion in the background (non-blocking)
      fetchSmartSuggestion(result);
    } catch (error) {
      Alert.alert('Analysis Error', error.message);
      setCapturedImage(null);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCancel = () => {
    setShowCamera(false);
  };

  const pickItemImage = async () => {
    // Check AI package first
    if (!userTier.hasAIPackage) {
      setShowUpgradeModal(true);
      return;
    }
    
    // Check daily limit
    if (userTier.analysesRemaining <= 0) {
      Alert.alert(
        'Daily Limit Reached',
        'You have used all 10 AI analyses for today. Upgrade to premium for unlimited access.',
        [
          { text: 'Upgrade', onPress: () => setShowUpgradeModal(true) },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant access to your photo library');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.3,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setAnalyzing(true);

      try {
        // FIRST: Save image to permanent storage immediately
        console.log('[OrganizeScreen] Saving uploaded image permanently...');
        const permanentUri = await saveImagePermanently(uri, 'item');
        console.log('[OrganizeScreen] Image saved to:', permanentUri);
        
        setCapturedImage(permanentUri);
        
        // THEN: Analyze the image
        const aiResult = await analyzeItem(permanentUri);
        
        // Record AI usage
        await recordAIAnalysis(DEVICE_ID);
        
        // Update local tier state
        setUserTier(prev => ({
          ...prev,
          analysesToday: prev.analysesToday + 1,
          analysesRemaining: prev.analysesRemaining - 1
        }));
        
        setAiResult(aiResult);
        
        // Generate importance questions based on AI analysis
        const questions = getImportanceQuestions(aiResult);
        setImportanceQuestions(questions);
        setImportanceAnswers({});
        setShowImportanceQuestions(true);

        // Fetch smart suggestion in the background (non-blocking)
        fetchSmartSuggestion(aiResult);
      } catch (error) {
        Alert.alert('Analysis Error', error.message);
        setCapturedImage(null);
      } finally {
        setAnalyzing(false);
      }
    }
  };

  const resetFlow = async () => {
    // Delete the permanently saved image if item was never saved to DB
    if (capturedImage && !itemSaved) {
      try {
        const fileInfo = await FileSystem.getInfoAsync(capturedImage);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(capturedImage, { idempotent: true });
          console.log('[resetFlow] Deleted unsaved image:', capturedImage);
        }
      } catch (e) {
        console.log('[resetFlow] Could not delete image:', e.message);
      }
    }
    setCapturedImage(null);
    setAiResult(null);
    setShowSpaceSelector(false);
    setShowImportanceQuestions(false);
    setImportanceQuestions(null);
    setImportanceAnswers({});
    setImportanceScore(null);
    setLocationDescription('');
    setItemSaved(false);
    setSmartSuggestion(null);
    setLoadingSuggestion(false);
  };

  const handleAnswerQuestion = (questionId, value) => {
    setImportanceAnswers(prev => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handleCalculateImportance = () => {
    if (!importanceQuestions) return;
    
    // Check if all questions answered
    const allAnswered = importanceQuestions.questions.every(
      q => importanceAnswers[q.id] !== undefined
    );
    
    if (!allAnswered) {
      Alert.alert('Answer All Questions', 'Please answer all questions to calculate importance.');
      return;
    }
    
    const score = calculateImportanceScore(
      importanceQuestions.categoryKey,
      importanceAnswers
    );
    setImportanceScore(score);
  };

  const handleSkipImportance = () => {
    setShowImportanceQuestions(false);
    setImportanceScore({
      priority: 'medium',
      action: '🗄️ Standard Storage (Skipped)',
      storageLocation: 'Standard storage area',
      category: importanceQuestions?.category || 'General',
      keepScore: 50,
    });
  };

  const openEditAIResult = () => {
    if (!aiResult) return;
    setEditItemName(aiResult.itemName);
    setEditTags(aiResult.tags.join(', '));
    setShowEditAIResult(true);
  };

  const closeEditAIResult = () => {
    setShowEditAIResult(false);
  };

  const handleSaveEditAndReanalyze = async () => {
    if (!aiResult || !editItemName.trim()) return;
    
    setIsReanalyzing(true);
    try {
      // Update AI result with edited values
      const updatedTags = editTags.split(',').map(t => t.trim()).filter(t => t);
      const updatedResult = {
        ...aiResult,
        itemName: editItemName.trim(),
        tags: updatedTags.length > 0 ? updatedTags : aiResult.tags,
      };
      
      setAiResult(updatedResult);
      
      // Regenerate importance questions based on edited info
      const newQuestions = getImportanceQuestions(updatedResult);
      setImportanceQuestions(newQuestions);
      setImportanceAnswers({});
      setImportanceScore(null);
      
      setShowEditAIResult(false);
      
      Alert.alert(
        'Updated!',
        `Item details updated. New category: ${newQuestions.category}\n\nAnswer the importance questions to get storage recommendations.`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to update: ' + error.message);
    } finally {
      setIsReanalyzing(false);
    }
  };

  const handleAssignSpace = async (space) => {
    if (!aiResult) return;

    setSaving(true);
    try {
      // Image is already saved permanently from handleCapture
      await saveItem({
        itemName: aiResult.itemName,
        tags: aiResult.tags,
        recommendedIdealSpace: aiResult.recommendedIdealSpace,
        organizationTips: aiResult.organizationTips,
        assignedSpaceId: space.id,
        imageUri: capturedImage, // Already permanent
        locationDescription: locationDescription || null,
      });

      setItemSaved(true);
      Alert.alert(
        'Success!',
        `"${aiResult.itemName}" has been assigned to:\n${space.macro_space} - ${space.micro_zone}\n\nPriority: ${importanceScore?.action || 'Standard'}`,
        [{ text: 'OK', onPress: resetFlow }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to save item: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateNewSpace = () => {
    if (!aiResult?.recommendedIdealSpace) return;
    
    // Pre-fill with AI suggestion
    const suggestion = aiResult.recommendedIdealSpace;
    setNewMacroSpace(suggestion.split(' ')[0] || '');
    setNewMicroZone(suggestion.split(' ').slice(-2).join(' ') || '');
    setShowCreateSpaceModal(true);
  };

  const handleConfirmCreateSpace = async () => {
    if (!newMacroSpace.trim() || !newMicroZone.trim()) {
      Alert.alert('Error', 'Please enter both Macro Space and Micro Zone');
      return;
    }
    
    try {
      const newSpace = await saveSpace({
        macroSpace: newMacroSpace,
        microZone: newMicroZone,
        imageUri: null
      });
      setShowCreateSpaceModal(false);
      setNewMacroSpace('');
      setNewMicroZone('');
      await loadSpaces();
      handleAssignSpace(newSpace);
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const handleSaveWithoutSpace = async () => {
    if (!aiResult) return;

    setSaving(true);
    try {
      // Image is already saved permanently from handleCapture
      await saveItem({
        itemName: aiResult.itemName,
        tags: aiResult.tags,
        recommendedIdealSpace: aiResult.recommendedIdealSpace,
        organizationTips: aiResult.organizationTips,
        assignedSpaceId: null,
        imageUri: capturedImage, // Already permanent
        locationDescription: locationDescription || null,
      });

      setItemSaved(true);
      Alert.alert(
        'Saved!',
        `"${aiResult.itemName}" saved without assigned space.\n\nPriority: ${importanceScore?.action || 'Standard'}\n\nYou can assign it later from the Find Item screen.`,
        [{ text: 'OK', onPress: resetFlow }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to save item: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleActivateAIPackage = async () => {
    if (!promoCode.trim()) {
      Alert.alert('Error', 'Please enter a promo code');
      return;
    }
    
    const success = await activateAIPackage(DEVICE_ID, promoCode.trim());
    
    if (success) {
      // Fetch fresh tier directly from DB - don't rely on stale state
      const freshTier = await checkUserAITier(DEVICE_ID);
      setUserTier(freshTier);
      setShowUpgradeModal(false);
      setPromoCode('');
      
      // If user had a pending image, pass fresh tier directly to avoid stale state loop
      if (pendingImageUri) {
        const uri = pendingImageUri;
        setPendingImageUri(null);
        handleCapture(uri, freshTier);
      } else {
        Alert.alert('Success!', 'AI package activated! You can now take a photo.');
      }
    } else {
      Alert.alert('Invalid Code', 'The promo code you entered is invalid or has expired.');
    }
  };

  const renderSpaceItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.spaceOption}
      onPress={() => handleAssignSpace(item)}
      disabled={saving}
    >
      <Text style={styles.spaceOptionMacro}>{item.macro_space}</Text>
      <Text style={styles.spaceOptionMicro}>{item.micro_zone}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Modal
        visible={showCamera}
        animationType="slide"
        onRequestClose={handleCancel}
      >
        <CameraComponent onCapture={handleCapture} onCancel={handleCancel} />
      </Modal>

      <Modal
        visible={showCreateSpaceModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateSpaceModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create New Space</Text>
            <Text style={styles.modalSubtitle}>Based on AI recommendation</Text>
            
            <Text style={styles.inputLabel}>Macro Space (Room/Area)</Text>
            <TextInput
              style={styles.textInput}
              value={newMacroSpace}
              onChangeText={setNewMacroSpace}
              placeholder="e.g., Living Room, Kitchen"
              placeholderTextColor="#999"
            />
            
            <Text style={styles.inputLabel}>Micro Zone (Specific Location)</Text>
            <TextInput
              style={styles.textInput}
              value={newMicroZone}
              onChangeText={setNewMicroZone}
              placeholder="e.g., Top Shelf, Drawer 1"
              placeholderTextColor="#999"
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => setShowCreateSpaceModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.createButton]} 
                onPress={handleConfirmCreateSpace}
              >
                <Text style={styles.createButtonText}>Create & Assign</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Importance Questions Modal */}
      <Modal
        visible={showImportanceQuestions}
        animationType="slide"
        transparent={true}
        onRequestClose={handleSkipImportance}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.importanceModalContent]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Item Importance</Text>
                <TouchableOpacity onPress={handleSkipImportance} style={styles.closeButton}>
                  <Text style={styles.closeText}>✕</Text>
                </TouchableOpacity>
              </View>
              
              <Text style={styles.importanceSubtitle}>
                {importanceQuestions?.category} - Help us determine where to store this
              </Text>

              {importanceScore ? (
                <View style={styles.scoreContainer}>
                  <Text style={[styles.scoreAction, 
                    importanceScore.priority === 'toss' && styles.tossAction,
                    importanceScore.priority === 'high' && styles.highAction,
                  ]}>
                    {importanceScore.action}
                  </Text>
                  <Text style={styles.scoreLabel}>Keep Score: {importanceScore.keepScore}%</Text>
                  <View style={styles.progressBarTrack}>
                    <View style={[
                      styles.progressBarFill,
                      { width: `${importanceScore.keepScore}%` },
                      importanceScore.priority === 'toss' && { backgroundColor: '#e74c3c' },
                      importanceScore.priority === 'low' && { backgroundColor: '#e67e22' },
                      importanceScore.priority === 'medium' && { backgroundColor: '#3498db' },
                      importanceScore.priority === 'high' && { backgroundColor: '#27ae60' },
                    ]} />
                  </View>
                  <Text style={styles.storageRec}>
                    📍 {importanceScore.storageLocation}
                  </Text>
                  
                  <TouchableOpacity 
                    style={styles.continueButton}
                    onPress={() => {
                      setShowImportanceQuestions(false);
                      setShowSpaceSelector(true);
                    }}
                  >
                    <Text style={styles.continueButtonText}>Continue to Assign Space</Text>
                  </TouchableOpacity>
                  
                  {importanceScore.priority === 'toss' && (
                    <TouchableOpacity 
                      style={styles.tossButton}
                      onPress={() => {
                        Alert.alert(
                          'Mark for Removal',
                          'This will save the item as "Toss/Donate". You can delete it fully later.',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Save as Toss', onPress: handleSaveWithoutSpace }
                          ]
                        );
                      }}
                    >
                      <Text style={styles.tossButtonText}>💾 Save as "To Toss"</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <>
                  {importanceQuestions?.questions.map((q, index) => (
                    <View key={q.id} style={styles.questionContainer}>
                      <Text style={styles.questionText}>
                        {index + 1}. {q.question}
                      </Text>
                      <View style={styles.optionsContainer}>
                        {q.options.map(option => (
                          <TouchableOpacity
                            key={option.value}
                            style={[
                              styles.optionButton,
                              importanceAnswers[q.id] === option.value && styles.optionSelected,
                            ]}
                            onPress={() => handleAnswerQuestion(q.id, option.value)}
                          >
                            <Text style={[
                              styles.optionText,
                              importanceAnswers[q.id] === option.value && styles.optionTextSelected,
                            ]}>
                              {option.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  ))}
                  
                  <TouchableOpacity 
                    style={styles.calculateButton}
                    onPress={handleCalculateImportance}
                  >
                    <Text style={styles.calculateButtonText}>Calculate Importance</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.editFirstButton}
                    onPress={() => {
                      setShowImportanceQuestions(false);
                      openEditAIResult();
                    }}
                  >
                    <Text style={styles.editFirstButtonText}>✏️ Edit Details First</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.skipButton}
                    onPress={handleSkipImportance}
                  >
                    <Text style={styles.skipButtonText}>Skip Questions</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit AI Result Modal */}
      <Modal
        visible={showEditAIResult}
        animationType="slide"
        transparent={true}
        onRequestClose={closeEditAIResult}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Item Details</Text>
              <TouchableOpacity onPress={closeEditAIResult} style={styles.closeButton}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.editSubtitle}>
              AI made a mistake? Fix it here and we'll update the questions.
            </Text>

            <Text style={styles.inputLabel}>Item Name</Text>
            <TextInput
              style={styles.textInput}
              value={editItemName}
              onChangeText={setEditItemName}
              placeholder="e.g., Red Winter Jacket"
              placeholderTextColor="#999"
            />

            <Text style={styles.inputLabel}>Tags (comma separated)</Text>
            <TextInput
              style={styles.textInput}
              value={editTags}
              onChangeText={setEditTags}
              placeholder="e.g., clothing, jacket, winter, red"
              placeholderTextColor="#999"
            />
            <Text style={styles.inputHint}>These help with searching later</Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={closeEditAIResult}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.createButton]}
                onPress={handleSaveEditAndReanalyze}
                disabled={isReanalyzing}
              >
                {isReanalyzing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.createButtonText}>Save & Update</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.header}>
        <Text style={styles.title}>Organize Item</Text>
        <Text style={styles.subtitle}>
          {aiResult ? 'AI Analysis Complete' : 'Snap a photo to get started'}
        </Text>
      </View>

      {!capturedImage ? (
        <View style={styles.startContainer}>
          <View style={styles.instructionBox}>
            <Text style={styles.instructionEmoji}>📸</Text>
            <Text style={styles.instruction}>
              Take a photo of any household item and let AI tell you:
            </Text>
            <View style={styles.bulletPoints}>
              <Text style={styles.bullet}>• What it is</Text>
              <Text style={styles.bullet}>• Where it should go</Text>
              <Text style={styles.bullet}>• How to store it properly</Text>
            </View>
          </View>
          <View style={styles.photoButtons}>
            <TouchableOpacity
              style={styles.cameraButton}
              onPress={() => setShowCamera(true)}
            >
              <Text style={styles.cameraButtonText}>📷 Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cameraButton, styles.uploadButton]}
              onPress={pickItemImage}
            >
              <Text style={styles.cameraButtonText}>🖼️ Upload</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : analyzing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90D9" />
          <Text style={styles.loadingText}>AI is analyzing your item...</Text>
          <Text style={styles.loadingSubtext}>This may take a few seconds</Text>
        </View>
      ) : aiResult ? (
        <ScrollView style={styles.resultScroll} contentContainerStyle={styles.resultContent}>
          <View style={styles.aiCard}>
            <Text style={styles.aiLabel}>Item Identified</Text>
            <Text style={styles.aiItemName}>{aiResult.itemName}</Text>
            
            {aiResult.isPlaceholder && (
              <View style={styles.placeholderBanner}>
                <Text style={styles.placeholderText}>⚠️ Using placeholder (Gemini API not configured)</Text>
              </View>
            )}
            
            <TouchableOpacity style={styles.editDetailsButton} onPress={openEditAIResult}>
              <Text style={styles.editDetailsText}>✏️ Edit Details</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.aiCard}>
            <Text style={styles.aiLabel}>Recommended Ideal Space</Text>
            <Text style={styles.aiRecommendation}>{aiResult.recommendedIdealSpace}</Text>
          </View>

          <View style={styles.aiCard}>
            <Text style={styles.aiLabel}>Organization Tips</Text>
            <Text style={styles.aiTips}>{aiResult.organizationTips}</Text>
          </View>

          <View style={styles.aiCard}>
            <Text style={styles.aiLabel}>Search Tags</Text>
            <View style={styles.tagsContainer}>
              {aiResult.tags?.map((tag, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* ── Smart Suggestion Card ── */}
          {loadingSuggestion ? (
            <View style={styles.suggestionCard}>
              <ActivityIndicator size="small" color="#7B4FD9" />
              <Text style={styles.suggestionLoading}>Getting smart suggestions...</Text>
            </View>
          ) : smartSuggestion ? (
            <View style={styles.suggestionCard}>
              <Text style={styles.suggestionHeader}>✨ Smart Suggestion</Text>

              <View style={styles.suggestionRow}>
                <Text style={styles.suggestionIcon}>📍</Text>
                <View style={styles.suggestionTextBlock}>
                  <Text style={styles.suggestionLabel}>Best Space</Text>
                  <Text style={styles.suggestionValue}>{smartSuggestion.bestSpaceLabel}</Text>
                  {smartSuggestion.reasoning ? (
                    <Text style={styles.suggestionReasoning}>{smartSuggestion.reasoning}</Text>
                  ) : null}
                </View>
              </View>

              <View style={styles.suggestionDivider} />

              <View style={styles.suggestionRow}>
                <Text style={styles.suggestionIcon}>🗂️</Text>
                <View style={styles.suggestionTextBlock}>
                  <Text style={styles.suggestionLabel}>Suggested Organizer</Text>
                  <Text style={styles.suggestionValue}>{smartSuggestion.suggestedOrganizer}</Text>
                </View>
              </View>

              <View style={styles.suggestionDivider} />

              <View style={styles.suggestionRow}>
                <Text style={styles.suggestionIcon}>
                  {smartSuggestion.keepOrDiscard === 'keep' ? '✅' :
                   smartSuggestion.keepOrDiscard === 'donate' ? '💝' : '🤔'}
                </Text>
                <View style={styles.suggestionTextBlock}>
                  <Text style={styles.suggestionLabel}>
                    {smartSuggestion.keepOrDiscard === 'keep' ? 'Keep It' :
                     smartSuggestion.keepOrDiscard === 'donate' ? 'Consider Donating' : 'Consider Discarding'}
                  </Text>
                  <Text style={styles.suggestionReasoning}>{smartSuggestion.keepOrDiscardReason}</Text>
                </View>
              </View>

              {smartSuggestion.bestSpaceId && (
                <TouchableOpacity
                  style={styles.useSuggestionButton}
                  onPress={() => {
                    const match = spaces.find(s => s.id === smartSuggestion.bestSpaceId);
                    if (match) handleAssignSpace(match);
                  }}
                  disabled={saving}
                >
                  <Text style={styles.useSuggestionText}>Use This Space →</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}

          <Text style={styles.assignPrompt}>Where will you store this item?</Text>

          <Text style={styles.inputLabel}>📍 Specific Location (Optional)</Text>
          <TextInput
            style={styles.textInput}
            value={locationDescription}
            onChangeText={setLocationDescription}
            placeholder="e.g., Top left drawer, Under bed, Shelf 3"
            placeholderTextColor="#999"
          />
          <Text style={styles.inputHint}>Where exactly within the space?</Text>

          {spaces.length > 0 ? (
            <>
              <Text style={styles.sectionLabel}>Select existing space:</Text>
              <FlatList
                data={spaces}
                keyExtractor={(item) => item.id}
                renderItem={renderSpaceItem}
                scrollEnabled={false}
                style={styles.spaceList}
              />
            </>
          ) : null}

          <TouchableOpacity style={styles.createSpaceButton} onPress={handleCreateNewSpace}>
            <Text style={styles.createSpaceText}>+ Create New Space Based on AI Recommendation</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipButton} onPress={handleSaveWithoutSpace} disabled={saving}>
            <Text style={styles.skipButtonText}>
              {saving ? 'Saving...' : '💾 Save Without Assigning Space'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.resetButton} onPress={resetFlow}>
            <Text style={styles.resetButtonText}>Start Over</Text>
          </TouchableOpacity>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      ) : (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to analyze image</Text>
          <TouchableOpacity style={styles.resetButton} onPress={resetFlow}>
            <Text style={styles.resetButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Upgrade Modal */}
      <Modal
        visible={showUpgradeModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowUpgradeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🔒 AI Analysis Locked</Text>
              <TouchableOpacity onPress={() => setShowUpgradeModal(false)} style={styles.closeButton}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              <Text style={styles.upgradeDescription}>
                To use AI-powered item analysis, upgrade to one of our plans:
              </Text>

              <View style={styles.pricingCard}>
                <Text style={styles.pricingTitle}>📦 Base Plan</Text>
                <Text style={styles.pricingPrice}>$10/year</Text>
                <Text style={styles.pricingFeature}>✓ Upload unlimited items</Text>
                <Text style={styles.pricingFeature}>✓ Organize spaces</Text>
                <Text style={styles.pricingSubtext}>AI Analysis sold separately</Text>
              </View>

              <View style={[styles.pricingCard, styles.pricingCardFeatured]}>
                <Text style={styles.pricingBadge}>BEST VALUE</Text>
                <Text style={styles.pricingTitle}>🤖 AI Analysis Add-on</Text>
                <Text style={styles.pricingPrice}>$5/month</Text>
                <Text style={styles.pricingPriceDiscount}>or $20/year (save $40!)</Text>
                <Text style={styles.pricingFeature}>✓ 10 AI analyses per day</Text>
                <Text style={styles.pricingFeature}>✓ Item identification</Text>
                <Text style={styles.pricingFeature}>✓ Storage recommendations</Text>
                <Text style={styles.pricingFeature}>✓ Organization tips</Text>
              </View>

              <View style={styles.divider} />

              <Text style={styles.sectionLabel}>Have a promo code?</Text>
              <TextInput
                style={styles.textInput}
                value={promoCode}
                onChangeText={setPromoCode}
                placeholder="Enter promo code"
                placeholderTextColor="#999"
                autoCapitalize="characters"
              />
              <TouchableOpacity 
                style={styles.modalButton}
                onPress={handleActivateAIPackage}
              >
                <Text style={styles.modalButtonText}>Activate with Code</Text>
              </TouchableOpacity>

              <View style={styles.divider} />

              <Text style={styles.sectionLabel}>Need a code?</Text>
              <Text style={styles.requestDescription}>
                Contact the app owner for a free promo code. Each code can only be used once.
              </Text>

              <View style={styles.modalButtons}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setShowUpgradeModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  startContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  instructionBox: {
    backgroundColor: '#fff',
    padding: 30,
    borderRadius: 16,
    marginBottom: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  instructionEmoji: {
    fontSize: 50,
    marginBottom: 15,
  },
  instruction: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginBottom: 15,
    lineHeight: 24,
  },
  bulletPoints: {
    alignSelf: 'flex-start',
    marginTop: 5,
  },
  bullet: {
    fontSize: 15,
    color: '#666',
    marginVertical: 3,
  },
  cameraButton: {
    backgroundColor: '#4A90D9',
    paddingVertical: 20,
    paddingHorizontal: 50,
    borderRadius: 15,
    shadowColor: '#4A90D9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  cameraButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  // Loading state
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 18,
    color: '#333',
    marginTop: 20,
    fontWeight: '600',
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#888',
    marginTop: 10,
  },
  // Results
  resultScroll: {
    flex: 1,
  },
  resultContent: {
    padding: 20,
  },
  aiCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  aiLabel: {
    fontSize: 12,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  aiItemName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  aiRecommendation: {
    fontSize: 16,
    color: '#4A90D9',
    fontWeight: '500',
    lineHeight: 24,
  },
  aiTips: {
    fontSize: 15,
    color: '#555',
    lineHeight: 22,
  },
  placeholderBanner: {
    backgroundColor: '#FFF3CD',
    padding: 10,
    borderRadius: 8,
    marginTop: 15,
  },
  placeholderText: {
    fontSize: 13,
    color: '#856404',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    fontSize: 13,
    color: '#1976D2',
    fontWeight: '500',
  },
  assignPrompt: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 10,
    marginBottom: 15,
  },
  sectionLabel: {
    fontSize: 14,
    color: '#888',
    marginBottom: 10,
  },
  spaceList: {
    marginBottom: 15,
  },
  spaceOption: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  spaceOptionMacro: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  spaceOptionMicro: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  createSpaceButton: {
    backgroundColor: '#E8F5E9',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#4CAF50',
    borderStyle: 'dashed',
  },
  createSpaceText: {
    fontSize: 15,
    color: '#2E7D32',
    fontWeight: '600',
    textAlign: 'center',
  },
  skipButton: {
    backgroundColor: '#FFF8E1',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 2,
    borderColor: '#FFC107',
  },
  skipButtonText: {
    fontSize: 15,
    color: '#F57C00',
    fontWeight: '600',
    textAlign: 'center',
  },
  resetButton: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: 40,
  },
  // Smart suggestion card
  suggestionCard: {
    backgroundColor: '#F3EEFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 15,
    borderWidth: 1.5,
    borderColor: '#C4A8F5',
  },
  suggestionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B3DBF',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  suggestionLoading: {
    fontSize: 13,
    color: '#7B4FD9',
    marginLeft: 10,
    fontStyle: 'italic',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 4,
  },
  suggestionIcon: {
    fontSize: 18,
    marginRight: 10,
    marginTop: 1,
  },
  suggestionTextBlock: {
    flex: 1,
  },
  suggestionLabel: {
    fontSize: 11,
    color: '#9B7FD4',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '600',
    marginBottom: 2,
  },
  suggestionValue: {
    fontSize: 15,
    color: '#3D1A78',
    fontWeight: '600',
    lineHeight: 20,
  },
  suggestionReasoning: {
    fontSize: 13,
    color: '#7B5CAD',
    marginTop: 2,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  suggestionDivider: {
    height: 1,
    backgroundColor: '#D9C5F7',
    marginVertical: 8,
  },
  useSuggestionButton: {
    backgroundColor: '#7B4FD9',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  useSuggestionText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  // Error state
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 16,
    color: '#ff4444',
    marginBottom: 20,
  },
  // Create Space Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
    marginTop: 12,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#f9f9f9',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  editSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    fontStyle: 'italic',
  },
  inputHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 24,
    gap: 12,
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  createButton: {
    backgroundColor: '#4CAF50',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 15,
  },
  uploadButton: {
    backgroundColor: '#66BB6A',
  },
  // Importance Questions
  importanceModalContent: {
    maxHeight: '80%',
  },
  importanceSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    fontStyle: 'italic',
  },
  questionContainer: {
    marginBottom: 20,
  },
  questionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  optionsContainer: {
    flexDirection: 'column',
    gap: 8,
  },
  optionButton: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  optionSelected: {
    backgroundColor: '#E3F2FD',
    borderColor: '#1976D2',
  },
  optionText: {
    fontSize: 14,
    color: '#555',
  },
  optionTextSelected: {
    color: '#1976D2',
    fontWeight: '600',
  },
  editDetailsButton: {
    backgroundColor: '#F5F5F5',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  editDetailsText: {
    color: '#666',
    fontSize: 13,
    fontWeight: '500',
  },
  calculateButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  calculateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  editFirstButton: {
    backgroundColor: '#E3F2FD',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#1976D2',
  },
  editFirstButtonText: {
    color: '#1976D2',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    backgroundColor: '#FFF8E1',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 2,
    borderColor: '#FFC107',
  },
  skipButtonText: {
    fontSize: 15,
    color: '#F57C00',
    fontWeight: '600',
    textAlign: 'center',
  },
  scoreContainer: {
    alignItems: 'center',
    padding: 20,
  },
  scoreAction: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  highAction: {
    color: '#4CAF50',
  },
  tossAction: {
    color: '#F44336',
  },
  scoreLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#555',
    marginTop: 8,
    marginBottom: 8,
  },
  progressBarTrack: {
    width: '100%',
    height: 16,
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 8,
    backgroundColor: '#3498db',
  },
  storageRec: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  continueButton: {
    backgroundColor: '#4A90D9',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    minWidth: 200,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  tossButton: {
    backgroundColor: '#FFEBEE',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 15,
    borderWidth: 2,
    borderColor: '#F44336',
  },
  tossButtonText: {
    color: '#F44336',
    fontSize: 16,
    fontWeight: '600',
  },
});
