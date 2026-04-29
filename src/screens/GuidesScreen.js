import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  RefreshControl,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { getAllGuides, saveGuide, updateGuide, deleteGuide } from '../services/dbService';

/**
 * Guides Screen - "My Guides"
 * Manual content entry for organizing principles, book excerpts, rules
 * These are injected into AI prompts for smart suggestions
 */
export default function GuidesScreen() {
  const [guides, setGuides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingGuide, setEditingGuide] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [sourceLabel, setSourceLabel] = useState('');
  const [saving, setSaving] = useState(false);

  // View guide modal
  const [viewingGuide, setViewingGuide] = useState(null);

  useEffect(() => {
    loadGuides();
  }, []);

  const loadGuides = async () => {
    try {
      setLoading(true);
      const data = await getAllGuides();
      setGuides(data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load guides: ' + error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadGuides();
  }, []);

  // ── Modals ────────────────────────────────────────────────────

  const openAddModal = () => {
    setEditingGuide(null);
    setTitle('');
    setContent('');
    setSourceLabel('');
    setModalVisible(true);
  };

  const openEditModal = (guide) => {
    setEditingGuide(guide);
    setTitle(guide.title || '');
    setContent(guide.content || '');
    setSourceLabel(guide.source_label || '');
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingGuide(null);
    setTitle('');
    setContent('');
    setSourceLabel('');
  };

  // ── Save ─────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title for this guide entry');
      return;
    }
    if (!content.trim()) {
      Alert.alert('Error', 'Please enter some content for this guide entry');
      return;
    }

    try {
      setSaving(true);
      if (editingGuide) {
        await updateGuide(editingGuide.id, {
          title: title.trim(),
          content: content.trim(),
          sourceLabel: sourceLabel.trim() || null,
        });
      } else {
        await saveGuide({
          title: title.trim(),
          content: content.trim(),
          sourceLabel: sourceLabel.trim() || null,
        });
      }
      closeModal();
      loadGuides();
    } catch (error) {
      Alert.alert('Error', 'Failed to save guide: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Upload File ───────────────────────────────────────────────

  const handleUploadFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/plain', 'text/markdown', 'text/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets?.[0];
      if (!file) {
        Alert.alert('Error', 'No file selected');
        return;
      }

      // Read file content
      const content = await FileSystem.readAsStringAsync(file.uri);
      const title = file.name.replace(/\.[^/.]+$/, ''); // Remove extension

      // Save as guide
      await saveGuide({
        title: title.trim(),
        content: content.trim(),
        sourceLabel: `File: ${file.name}`,
      });

      loadGuides();
      Alert.alert('Imported', `"${file.name}" has been added to your guides.`);
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Error', 'Failed to read file: ' + error.message);
    }
  };

  // ── Delete ────────────────────────────────────────────────────

  const handleDelete = (guide) => {
    Alert.alert(
      'Delete Guide Entry',
      `Delete "${guide.title}"? This will no longer be used in AI suggestions.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await deleteGuide(guide.id);
              loadGuides();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete: ' + error.message);
            }
          },
        },
      ]
    );
  };

  // ── Render ────────────────────────────────────────────────────

  const renderGuideCard = ({ item }) => (
    <TouchableOpacity style={styles.guideCard} onPress={() => setViewingGuide(item)}>
      <View style={styles.guideCardHeader}>
        <View style={styles.guideIcon}>
          <Text style={styles.guideIconText}>📚</Text>
        </View>
        <View style={styles.guideInfo}>
          <Text style={styles.guideTitle} numberOfLines={2}>{item.title}</Text>
          {item.source_label ? (
            <Text style={styles.guideSource}>{item.source_label}</Text>
          ) : null}
          <Text style={styles.guidePreview} numberOfLines={2}>{item.content}</Text>
        </View>
        <View style={styles.guideActions}>
          <TouchableOpacity onPress={() => openEditModal(item)} style={styles.actionBtn}>
            <Text style={styles.actionBtnText}>✏️</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(item)} style={styles.actionBtn}>
            <Text style={styles.actionBtnText}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Guides</Text>
        <Text style={styles.subtitle}>
          {guides.length} entr{guides.length !== 1 ? 'ies' : 'y'} · Used by AI suggestions
        </Text>
      </View>

      <View style={styles.infoBanner}>
        <Text style={styles.infoBannerText}>
          💡 Add organizing principles, book excerpts, or personal rules here. The AI reads these when suggesting where to store items.
        </Text>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={[styles.addButton, styles.addButtonFlex]} onPress={openAddModal}>
          <Text style={styles.addButtonText}>+ Add Entry</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.addButton, styles.uploadButtonFlex]} onPress={handleUploadFile}>
          <Text style={styles.addButtonText}>📁 Upload File</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#4A90D9" />
      ) : (
        <FlatList
          data={guides}
          keyExtractor={(item) => item.id}
          renderItem={renderGuideCard}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>📖</Text>
              <Text style={styles.emptyTitle}>No guide entries yet</Text>
              <Text style={styles.emptyText}>
                Add principles from organizing books or your own rules. The AI will use them to give smarter advice.
              </Text>
            </View>
          }
        />
      )}

      {/* ── Add/Edit Modal ── */}
      <Modal animationType="slide" transparent visible={modalVisible} onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {editingGuide ? 'Edit Guide Entry' : 'Add Guide Entry'}
              </Text>

              <Text style={styles.inputLabel}>Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., KonMari — Category Order"
                value={title}
                onChangeText={setTitle}
                maxLength={120}
              />

              <Text style={styles.inputLabel}>Source / Book (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., The Life-Changing Magic of Tidying Up"
                value={sourceLabel}
                onChangeText={setSourceLabel}
                maxLength={150}
              />

              <Text style={styles.inputLabel}>Content *</Text>
              <TextInput
                style={[styles.input, styles.contentArea]}
                placeholder="Paste or type the organizing principle or excerpt here..."
                value={content}
                onChangeText={setContent}
                multiline
                textAlignVertical="top"
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={closeModal}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton, saving && styles.savingButton]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ── View Modal ── */}
      <Modal
        animationType="slide"
        transparent
        visible={viewingGuide !== null}
        onRequestClose={() => setViewingGuide(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.viewModalContent}>
            <ScrollView>
              <View style={styles.viewHeader}>
                <Text style={styles.viewTitle}>{viewingGuide?.title}</Text>
                {viewingGuide?.source_label ? (
                  <Text style={styles.viewSource}>📚 {viewingGuide.source_label}</Text>
                ) : null}
              </View>
              <Text style={styles.viewContent}>{viewingGuide?.content}</Text>
            </ScrollView>
            <View style={styles.viewModalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.editButton]}
                onPress={() => { setViewingGuide(null); openEditModal(viewingGuide); }}
              >
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.closeButton]}
                onPress={() => setViewingGuide(null)}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  subtitle: { fontSize: 14, color: '#888', marginTop: 4 },
  infoBanner: {
    backgroundColor: '#FFF8E1',
    margin: 16,
    marginBottom: 0,
    padding: 12,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
  },
  infoBannerText: { fontSize: 13, color: '#5D4037', lineHeight: 20 },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    margin: 16,
    marginBottom: 0,
  },
  addButton: {
    backgroundColor: '#4A90D9',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  addButtonFlex: { flex: 1 },
  uploadButtonFlex: { flex: 1, backgroundColor: '#5D8C3B' },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  list: { padding: 16, paddingTop: 4 },

  // ── Guide card ──
  guideCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 10,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 3,
    elevation: 2,
  },
  guideCardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  guideIcon: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#FFF8E1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  guideIconText: { fontSize: 22 },
  guideInfo: { flex: 1 },
  guideTitle: { fontSize: 15, fontWeight: '700', color: '#222' },
  guideSource: { fontSize: 12, color: '#4A90D9', marginTop: 2, fontStyle: 'italic' },
  guidePreview: { fontSize: 13, color: '#888', marginTop: 4, lineHeight: 18 },
  guideActions: { flexDirection: 'column', gap: 4, marginLeft: 8 },
  actionBtn: { padding: 4 },
  actionBtnText: { fontSize: 16 },

  // ── Empty ──
  emptyContainer: { alignItems: 'center', marginTop: 60, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 60, marginBottom: 20 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: '#333', marginBottom: 10 },
  emptyText: { textAlign: 'center', color: '#888', fontSize: 15, lineHeight: 22 },

  // ── Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalScrollContent: { justifyContent: 'center', flexGrow: 1 },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 16 },
  inputLabel: { fontSize: 14, color: '#666', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#f9f9f9',
  },
  contentArea: {
    height: 180,
    textAlignVertical: 'top',
    paddingTop: 12,
    lineHeight: 22,
  },
  modalButtons: { flexDirection: 'row', marginTop: 24, gap: 12 },
  modalButton: { flex: 1, padding: 14, borderRadius: 8, alignItems: 'center' },
  cancelButton: { backgroundColor: '#f0f0f0' },
  cancelButtonText: { color: '#666', fontSize: 16, fontWeight: '600' },
  saveButton: { backgroundColor: '#4A90D9' },
  savingButton: { backgroundColor: '#90b8e8' },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  // ── View Modal ──
  viewModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    maxHeight: '80%',
    margin: 20,
    marginTop: 'auto',
    marginBottom: 'auto',
    flex: 0,
  },
  viewHeader: { marginBottom: 16 },
  viewTitle: { fontSize: 20, fontWeight: 'bold', color: '#222' },
  viewSource: { fontSize: 14, color: '#4A90D9', marginTop: 6, fontStyle: 'italic' },
  viewContent: { fontSize: 15, color: '#444', lineHeight: 24 },
  viewModalButtons: { flexDirection: 'row', marginTop: 20, gap: 12 },
  editButton: { backgroundColor: '#4A90D9' },
  editButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  closeButton: { backgroundColor: '#f0f0f0' },
  closeButtonText: { color: '#666', fontSize: 16, fontWeight: '600' },
});
