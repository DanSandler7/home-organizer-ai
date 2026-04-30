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
  Image,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getAllSpacesHierarchical,
  buildSpaceTree,
  saveSpaceHierarchical,
  deleteSpace,
  getItemsInSpace,
  saveImagePermanently,
} from '../services/dbService';
import CameraComponent from '../components/CameraComponent';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

/**
 * Spaces Screen - "My Spaces"
 * Hierarchical: parent locations expand to show sub-locations with photos
 */
export default function SpacesScreen() {
  const [spaceTree, setSpaceTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [itemCounts, setItemCounts] = useState({});

  // Which parent cards are expanded
  const [expandedIds, setExpandedIds] = useState({});

  // Add/Edit modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSpace, setEditingSpace] = useState(null);
  const [parentIdForNew, setParentIdForNew] = useState(null); // set when adding a sub-location
  const [spaceName, setSpaceName] = useState('');
  const [microZone, setMicroZone] = useState('');
  const [additionalDescription, setAdditionalDescription] = useState('');
  const [spaceImageUri, setSpaceImageUri] = useState(null);
  const [showCamera, setShowCamera] = useState(false);

  // View detail modal
  const [viewingSpace, setViewingSpace] = useState(null);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    loadSpaces();
  }, []);

  const loadSpaces = async () => {
    try {
      setLoading(true);
      const flat = await getAllSpacesHierarchical();
      const tree = buildSpaceTree(flat);
      setSpaceTree(tree);

      // Load item counts for all spaces
      const counts = {};
      for (const space of flat) {
        if (!space.id.startsWith('placeholder')) {
          const items = await getItemsInSpace(space.id);
          counts[space.id] = items.length;
        } else {
          counts[space.id] = 0;
        }
      }
      setItemCounts(counts);
    } catch (error) {
      setLoadError(error.message);
      Alert.alert('Error', 'Failed to load spaces: ' + error.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadSpaces();
  }, []);

  const toggleExpand = (id) => {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // ── Open modals ──────────────────────────────────────────────

  const openAddParentModal = () => {
    setEditingSpace(null);
    setParentIdForNew(null);
    setSpaceName('');
    setMicroZone('');
    setAdditionalDescription('');
    setSpaceImageUri(null);
    setModalVisible(true);
  };

  const openAddSubModal = (parentSpace) => {
    setEditingSpace(null);
    setParentIdForNew(parentSpace.id);
    setSpaceName('');
    setMicroZone('');
    setAdditionalDescription('');
    setSpaceImageUri(null);
    setModalVisible(true);
  };

  const openEditModal = (space) => {
    setEditingSpace(space);
    setParentIdForNew(space.parent_id || null);
    setSpaceName(space.macro_space || '');
    setMicroZone(space.micro_zone || '');
    setAdditionalDescription(space.additional_description || '');
    setSpaceImageUri(space.image_uri || null);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingSpace(null);
    setParentIdForNew(null);
    setSpaceName('');
    setMicroZone('');
    setAdditionalDescription('');
    setSpaceImageUri(null);
    setShowCamera(false);
  };

  // ── Save ─────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!spaceName.trim()) {
      Alert.alert('Error', 'Please enter a name for this location');
      return;
    }

    try {
      let permanentImageUri = null;
      if (spaceImageUri && !spaceImageUri.startsWith(FileSystem.documentDirectory)) {
        permanentImageUri = await saveImagePermanently(spaceImageUri, 'space');
      } else {
        permanentImageUri = spaceImageUri;
      }

      const spaceData = {
        macroSpace: spaceName.trim(),
        microZone: microZone.trim() || '',
        additionalDescription: additionalDescription.trim() || null,
        imageUri: permanentImageUri,
        parentId: parentIdForNew,
      };

      await saveSpaceHierarchical(spaceData, editingSpace?.id || null);
      closeModal();
      loadSpaces();
    } catch (error) {
      Alert.alert('Error', 'Failed to save: ' + error.message);
    }
  };

  // ── Delete ───────────────────────────────────────────────────

  const handleDelete = (space, hasChildren) => {
    const count = itemCounts[space.id] || 0;
    let msg = 'Are you sure you want to delete this location?';
    if (hasChildren) msg = 'This location has sub-locations. Deleting it will also delete all sub-locations. Continue?';
    else if (count > 0) msg = `This location has ${count} item(s). Are you sure?`;

    Alert.alert('Delete Location', msg, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteSpace(space.id);
            loadSpaces();
          } catch (error) {
            Alert.alert('Error', 'Failed to delete: ' + error.message);
          }
        },
      },
    ]);
  };

  // ── Camera / Gallery ─────────────────────────────────────────

  const pickImageFromGallery = async () => {
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
    if (!result.canceled) setSpaceImageUri(result.assets[0].uri);
  };

  // ── Render helpers ───────────────────────────────────────────

  const renderSubLocation = (sub) => (
    <TouchableOpacity
      key={sub.id}
      style={styles.subCard}
      onPress={() => setViewingSpace(sub)}
    >
      {sub.image_uri ? (
        <Image source={{ uri: sub.image_uri }} style={styles.subImage} />
      ) : (
        <View style={styles.subImagePlaceholder}>
          <Text style={styles.subImagePlaceholderText}>🗄️</Text>
        </View>
      )}
      <View style={styles.subInfo}>
        <Text style={styles.subName}>{sub.macro_space}</Text>
        {sub.micro_zone ? <Text style={styles.subZone}>{sub.micro_zone}</Text> : null}
        {sub.additional_description ? (
          <Text style={styles.subDesc} numberOfLines={1}>{sub.additional_description}</Text>
        ) : null}
        <Text style={styles.itemCount}>{itemCounts[sub.id] || 0} items</Text>
      </View>
      <View style={styles.subActions}>
        <TouchableOpacity onPress={() => openEditModal(sub)} style={styles.actionBtn}>
          <Text style={styles.actionBtnText}>✏️</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDelete(sub, false)} style={styles.actionBtn}>
          <Text style={styles.actionBtnText}>🗑️</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderParentCard = (item) => {
    const isExpanded = !!expandedIds[item.id];
    const hasChildren = item.children && item.children.length > 0;

    return (
      <View key={item.id} style={styles.parentCard}>
        {/* Parent header row */}
        <TouchableOpacity
          style={styles.parentHeader}
          onPress={() => toggleExpand(item.id)}
          activeOpacity={0.7}
        >
          {item.image_uri ? (
            <Image source={{ uri: item.image_uri }} style={styles.parentThumb} />
          ) : (
            <View style={styles.parentThumbPlaceholder}>
              <Text style={styles.parentThumbEmoji}>📦</Text>
            </View>
          )}
          <View style={styles.parentInfo}>
            <Text style={styles.parentName}>{item.macro_space}</Text>
            {item.micro_zone ? <Text style={styles.parentZone}>{item.micro_zone}</Text> : null}
            <Text style={styles.parentMeta}>
              {item.children.length} sub-location{item.children.length !== 1 ? 's' : ''}
              {' · '}
              {itemCounts[item.id] || 0} items
            </Text>
          </View>
          <View style={styles.parentRight}>
            <TouchableOpacity onPress={() => openEditModal(item)} style={styles.actionBtn}>
              <Text style={styles.actionBtnText}>✏️</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDelete(item, hasChildren)} style={styles.actionBtn}>
              <Text style={styles.actionBtnText}>🗑️</Text>
            </TouchableOpacity>
            <Text style={styles.chevron}>{isExpanded ? '▲' : '▼'}</Text>
          </View>
        </TouchableOpacity>

        {/* Sub-locations + add button (when expanded) */}
        {isExpanded && (
          <View style={styles.subContainer}>
            {item.children.map(sub => renderSubLocation(sub))}
            <TouchableOpacity
              style={styles.addSubButton}
              onPress={() => openAddSubModal(item)}
            >
              <Text style={styles.addSubButtonText}>+ Add Sub-Location</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // ── Main render ──────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Storage Spaces</Text>
        <Text style={styles.subtitle}>{spaceTree.length} top-level location{spaceTree.length !== 1 ? 's' : ''}</Text>
      </View>

      {/* Diagnostic error display */}
      {loadError && (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Connection Error</Text>
          <Text style={styles.errorText}>{loadError}</Text>
          <Text style={styles.errorDebug}>
            URL: {process.env.EXPO_PUBLIC_SUPABASE_URL ? 'Set' : 'Missing'}{'\n'}
            Key: {process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ? 'Set' : 'Missing'}{'\n'}
            Check EAS env vars are set to "Sensitive" not "Secret"
          </Text>
        </View>
      )}

      <TouchableOpacity style={styles.addButton} onPress={openAddParentModal}>
        <Text style={styles.addButtonText}>+ Add Location</Text>
      </TouchableOpacity>

      <FlatList
        data={spaceTree}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => renderParentCard(item)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          !loading && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>📦</Text>
              <Text style={styles.emptyTitle}>No spaces yet</Text>
              <Text style={styles.emptyText}>Tap "Add Location" to map your first storage area</Text>
            </View>
          )
        }
      />

      {/* ── Add/Edit Modal ── */}
      <Modal animationType="slide" transparent visible={modalVisible} onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {editingSpace
                  ? 'Edit Location'
                  : parentIdForNew
                    ? 'Add Sub-Location'
                    : 'Add Location'}
              </Text>

              {parentIdForNew && !editingSpace && (
                <View style={styles.parentBadge}>
                  <Text style={styles.parentBadgeText}>
                    Sub-location of: {spaceTree.find(s => s.id === parentIdForNew)?.macro_space || '...'}
                  </Text>
                </View>
              )}

              <Text style={styles.inputLabel}>Name *</Text>
              <TextInput
                style={styles.input}
                placeholder={parentIdForNew ? 'e.g., Left Side Top Drawer' : 'e.g., Kitchen Island'}
                value={spaceName}
                onChangeText={setSpaceName}
                maxLength={100}
              />

              <Text style={styles.inputLabel}>Zone / Section (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Top Shelf"
                value={microZone}
                onChangeText={setMicroZone}
                maxLength={100}
              />

              <Text style={styles.inputLabel}>Additional Description (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="e.g., Behind the blue bin, second row"
                value={additionalDescription}
                onChangeText={setAdditionalDescription}
                multiline
                numberOfLines={3}
                maxLength={300}
              />

              <Text style={styles.inputLabel}>Photo (Optional)</Text>
              {spaceImageUri ? (
                <View style={styles.photoPreviewContainer}>
                  <Image source={{ uri: spaceImageUri }} style={styles.photoPreview} />
                  <View style={styles.photoButtons}>
                    <TouchableOpacity style={styles.photoOptionButton} onPress={() => setShowCamera(true)}>
                      <Text style={styles.photoOptionText}>📷 Retake</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.photoOptionButton} onPress={pickImageFromGallery}>
                      <Text style={styles.photoOptionText}>🖼️ Gallery</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.photoOptionButton} onPress={() => setSpaceImageUri(null)}>
                      <Text style={[styles.photoOptionText, { color: '#e53935' }]}>✕ Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.photoButtons}>
                  <TouchableOpacity style={styles.addPhotoButton} onPress={() => setShowCamera(true)}>
                    <Text style={styles.addPhotoText}>📷 Take Photo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.addPhotoButton} onPress={pickImageFromGallery}>
                    <Text style={styles.addPhotoText}>🖼️ Upload</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={closeModal}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleSave}>
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Camera Modal ── */}
      <Modal visible={showCamera} animationType="slide" onRequestClose={() => setShowCamera(false)}>
        <CameraComponent
          onCapture={(uri) => { setSpaceImageUri(uri); setShowCamera(false); }}
          onCancel={() => setShowCamera(false)}
        />
      </Modal>

      {/* ── View Detail Modal ── */}
      <Modal
        animationType="slide"
        transparent
        visible={viewingSpace !== null}
        onRequestClose={() => setViewingSpace(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.viewModalContent]}>
            {viewingSpace?.image_uri ? (
              <Image source={{ uri: viewingSpace.image_uri }} style={styles.viewSpaceImage} />
            ) : (
              <View style={styles.noImagePlaceholder}>
                <Text style={styles.noImageText}>🗄️ No Photo</Text>
              </View>
            )}
            <Text style={styles.viewMacroText}>{viewingSpace?.macro_space}</Text>
            {viewingSpace?.micro_zone ? (
              <Text style={styles.viewMicroText}>{viewingSpace.micro_zone}</Text>
            ) : null}
            {viewingSpace?.additional_description ? (
              <Text style={styles.viewDescription}>{viewingSpace.additional_description}</Text>
            ) : null}
            <Text style={styles.viewItemCount}>
              {itemCounts[viewingSpace?.id] || 0} items stored here
            </Text>
            <View style={styles.viewModalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.editButton]}
                onPress={() => { setViewingSpace(null); openEditModal(viewingSpace); }}
              >
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.closeButton]}
                onPress={() => setViewingSpace(null)}
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
  addButton: {
    margin: 16,
    backgroundColor: '#4A90D9',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  list: { padding: 16, paddingTop: 4 },

  // ── Parent card ──
  parentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  parentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  parentThumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
    marginRight: 12,
  },
  parentThumbPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#f0f4ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  parentThumbEmoji: { fontSize: 28 },
  parentInfo: { flex: 1 },
  parentName: { fontSize: 16, fontWeight: '700', color: '#222' },
  parentZone: { fontSize: 13, color: '#666', marginTop: 2 },
  parentMeta: { fontSize: 12, color: '#4A90D9', marginTop: 4, fontWeight: '500' },
  parentRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chevron: { fontSize: 12, color: '#999', marginLeft: 6 },

  // ── Sub-location ──
  subContainer: {
    backgroundColor: '#f8faff',
    borderTopWidth: 1,
    borderTopColor: '#e8eef8',
    paddingBottom: 8,
  },
  subCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginTop: 10,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e8eef8',
  },
  subImage: {
    width: 64,
    height: 64,
    borderRadius: 8,
    marginRight: 10,
  },
  subImagePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  subImagePlaceholderText: { fontSize: 26 },
  subInfo: { flex: 1 },
  subName: { fontSize: 14, fontWeight: '600', color: '#333' },
  subZone: { fontSize: 12, color: '#888', marginTop: 2 },
  subDesc: { fontSize: 11, color: '#aaa', marginTop: 2, fontStyle: 'italic' },
  itemCount: { fontSize: 11, color: '#4A90D9', marginTop: 4, fontWeight: '500' },
  subActions: { flexDirection: 'column', gap: 4 },
  actionBtn: { padding: 4 },
  actionBtnText: { fontSize: 16 },

  addSubButton: {
    marginHorizontal: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#4A90D9',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  addSubButtonText: { color: '#4A90D9', fontWeight: '600', fontSize: 14 },

  // ── Empty ──
  emptyContainer: { alignItems: 'center', marginTop: 60 },
  emptyEmoji: { fontSize: 60, marginBottom: 20 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: '#333', marginBottom: 10 },
  emptyText: { textAlign: 'center', color: '#888', fontSize: 16, paddingHorizontal: 40 },

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
  parentBadge: {
    backgroundColor: '#E3F2FD',
    borderRadius: 6,
    padding: 8,
    marginBottom: 12,
  },
  parentBadgeText: { fontSize: 13, color: '#1976D2', fontWeight: '500' },
  inputLabel: { fontSize: 14, color: '#666', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#f9f9f9',
  },
  textArea: { height: 80, textAlignVertical: 'top', paddingTop: 12 },
  photoPreviewContainer: { alignItems: 'center', marginBottom: 4 },
  photoPreview: { width: '100%', height: 160, borderRadius: 8, marginBottom: 8 },
  photoButtons: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  photoOptionButton: {
    flex: 1,
    backgroundColor: '#E3F2FD',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  photoOptionText: { color: '#1976D2', fontSize: 13, fontWeight: '600' },
  addPhotoButton: {
    flex: 1,
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4A90D9',
    borderStyle: 'dashed',
  },
  addPhotoText: { color: '#1976D2', fontSize: 14, fontWeight: '600' },
  modalButtons: { flexDirection: 'row', marginTop: 24, gap: 12 },
  modalButton: { flex: 1, padding: 14, borderRadius: 8, alignItems: 'center' },
  cancelButton: { backgroundColor: '#f0f0f0' },
  cancelButtonText: { color: '#666', fontSize: 16, fontWeight: '600' },
  saveButton: { backgroundColor: '#4A90D9' },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  // ── View Modal ──
  viewModalContent: { alignItems: 'center', padding: 24 },
  viewSpaceImage: { width: '100%', height: 200, borderRadius: 12, marginBottom: 16 },
  noImagePlaceholder: {
    width: '100%',
    height: 140,
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  noImageText: { fontSize: 18, color: '#888' },
  viewMacroText: { fontSize: 20, fontWeight: 'bold', color: '#333', textAlign: 'center' },
  viewMicroText: { fontSize: 15, color: '#666', marginTop: 6, textAlign: 'center' },
  viewDescription: { fontSize: 13, color: '#999', marginTop: 8, textAlign: 'center', fontStyle: 'italic' },
  viewItemCount: { fontSize: 14, color: '#4A90D9', marginTop: 10, fontWeight: '500' },
  viewModalButtons: { flexDirection: 'row', marginTop: 20, gap: 12 },
  editButton: { backgroundColor: '#4A90D9' },
  editButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  closeButton: { backgroundColor: '#f0f0f0' },
  closeButtonText: { color: '#666', fontSize: 16, fontWeight: '600' },

  // ── Error Diagnostic ──
  errorBox: {
    backgroundColor: '#ffebee',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#d32f2f',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#d32f2f',
    marginBottom: 4,
  },
  errorText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
  },
  errorDebug: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
});
