import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Keyboard,
  Modal,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { searchInventory, updateItem, getAllItemsAlphabetical, deleteItem, getAllSpacesHierarchical, buildSpaceTree } from '../services/dbService';

/**
 * Find Item Screen - "Find Item"
 * Full implementation: Search with AI recommendations, location details
 */
export default function FindItemScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [spacesFlat, setSpacesFlat] = useState([]);
  const [spaceTree, setSpaceTree] = useState([]);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [assigningItem, setAssigningItem] = useState(null);
  const [spaceSearch, setSpaceSearch] = useState('');
  const [spacesLoading, setSpacesLoading] = useState(false);
  const [viewMode, setViewMode] = useState('search'); // 'search' or 'alphabetical'
  const [allItems, setAllItems] = useState([]);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editName, setEditName] = useState('');
  const [editTags, setEditTags] = useState('');

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    
    Keyboard.dismiss();
    setHasSearched(true);
    setLoading(true);
    
    try {
      const searchResults = await searchInventory(query.trim());
      setResults(searchResults);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (hasSearched && query) {
      await handleSearch();
    }
    setRefreshing(false);
  }, [hasSearched, query, handleSearch]);

  const openItemDetail = (item) => {
    setSelectedItem(item);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedItem(null);
  };

  const openAssignModal = async (item) => {
    setAssigningItem(item);
    setSpaceSearch('');
    setSpacesFlat([]);
    setSpaceTree([]);
    setAssignModalVisible(true);
    setSpacesLoading(true);
    try {
      const flat = await getAllSpacesHierarchical();
      setSpacesFlat(flat);
      setSpaceTree(buildSpaceTree(flat));
    } catch (error) {
      console.error('Failed to load spaces:', error);
    } finally {
      setSpacesLoading(false);
    }
  };

  const closeAssignModal = () => {
    setAssignModalVisible(false);
    setAssigningItem(null);
    setSpacesFlat([]);
    setSpaceTree([]);
    setSpaceSearch('');
    setSpacesLoading(false);
  };

  const handleAssignSpace = async (space) => {
    if (!assigningItem) return;

    try {
      await updateItem(assigningItem.id, { assignedSpaceId: space.id });

      // Build a spaces object that matches the Supabase join shape
      const spaceJoin = {
        id: space.id,
        macro_space: space.macro_space,
        micro_zone: space.micro_zone,
        additional_description: space.additional_description || null,
        parent_id: space.parent_id || null,
      };

      // Patch both results lists and the open detail modal
      const patcher = (item) =>
        item.id === assigningItem.id
          ? { ...item, assigned_space_id: space.id, spaces: spaceJoin }
          : item;

      setResults(prev => prev.map(patcher));
      setAllItems(prev => prev.map(patcher));

      if (selectedItem && selectedItem.id === assigningItem.id) {
        setSelectedItem(prev => ({ ...prev, assigned_space_id: space.id, spaces: spaceJoin }));
      }

      const label = spaceLabel(space);
      Alert.alert('Saved', `"${assigningItem.item_name}" moved to ${label}`);
      closeAssignModal();
    } catch (error) {
      Alert.alert('Error', 'Failed to assign item: ' + error.message);
    }
  };

  // Build "Parent > Child" label for a space
  const spaceLabel = (space) => {
    if (!space.parent_id) return space.macro_space;
    const parent = spacesFlat.find(s => s.id === space.parent_id);
    const parentName = parent ? parent.macro_space : '';
    return parentName ? `${parentName} › ${space.macro_space}` : space.macro_space;
  };

  // Flat searchable list derived from tree (preserves parent context)
  const searchableSpaces = React.useMemo(() => {
    const rows = [];
    spaceTree.forEach(parent => {
      rows.push({ ...parent, _isParent: true, _label: parent.macro_space });
      (parent.children || []).forEach(child => {
        rows.push({ ...child, _isParent: false, _label: `${parent.macro_space} › ${child.macro_space}` });
        (child.children || []).forEach(grandchild => {
          rows.push({ ...grandchild, _isParent: false, _label: `${parent.macro_space} › ${child.macro_space} › ${grandchild.macro_space}` });
        });
      });
    });
    return rows;
  }, [spaceTree]);

  const filteredSpaces = React.useMemo(() => {
    const q = spaceSearch.trim().toLowerCase();
    if (!q) return searchableSpaces;
    return searchableSpaces.filter(s => s._label.toLowerCase().includes(q));
  }, [searchableSpaces, spaceSearch]);

  const loadAllItems = async () => {
    setLoading(true);
    try {
      const items = await getAllItemsAlphabetical();
      setAllItems(items);
    } catch (error) {
      console.error('Failed to load items:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleViewMode = () => {
    if (viewMode === 'search') {
      setViewMode('alphabetical');
      loadAllItems();
    } else {
      setViewMode('search');
    }
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setEditName(item.item_name);
    setEditTags(item.tags?.join(', ') || '');
    setEditModalVisible(true);
  };

  const closeEditModal = () => {
    setEditModalVisible(false);
    setEditingItem(null);
    setEditName('');
    setEditTags('');
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    
    try {
      const updatedItem = await updateItem(editingItem.id, {
        itemName: editName.trim(),
        tags: editTags.split(',').map(t => t.trim()).filter(t => t),
      });
      
      // Update local state
      setAllItems(prev => prev.map(item => 
        item.id === editingItem.id 
          ? { ...item, item_name: updatedItem.item_name, tags: updatedItem.tags }
          : item
      ));
      
      setResults(prev => prev.map(item => 
        item.id === editingItem.id 
          ? { ...item, item_name: updatedItem.item_name, tags: updatedItem.tags }
          : item
      ));
      
      if (selectedItem && selectedItem.id === editingItem.id) {
        setSelectedItem(prev => ({ 
          ...prev, 
          item_name: updatedItem.item_name, 
          tags: updatedItem.tags 
        }));
      }
      
      Alert.alert('Success', 'Item updated');
      closeEditModal();
    } catch (error) {
      Alert.alert('Error', 'Failed to update item: ' + error.message);
    }
  };

  const handleDeleteItem = (item) => {
    Alert.alert(
      'Delete Item',
      `Are you sure you want to delete "${item.item_name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteItem(item.id);
              
              // Update local state
              setResults(prev => prev.filter(i => i.id !== item.id));
              setAllItems(prev => prev.filter(i => i.id !== item.id));
              
              // Close modal if open
              if (selectedItem?.id === item.id) {
                closeModal();
              }
              
              Alert.alert('Deleted', `"${item.item_name}" has been removed.`);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete item: ' + error.message);
            }
          },
        },
      ]
    );
  };

  const renderResultItem = ({ item }) => {
    const hasSpace = item.assigned_space_id && item.spaces;
    
    return (
      <TouchableOpacity 
        style={styles.resultCard}
        onPress={() => openItemDetail(item)}
      >
        <Text style={styles.itemName}>{item.item_name}</Text>
        
        {hasSpace ? (
          <View style={styles.locationContainer}>
            <Text style={styles.locationLabel}>📍 Stored in:</Text>
            <Text style={styles.locationText}>
              {item.spaces.parent_id
                ? `${item.spaces.macro_space}`
                : item.spaces.macro_space}
            </Text>
            {item.spaces.micro_zone ? (
              <Text style={styles.microText}>{item.spaces.micro_zone}</Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.unassignedBadge}>
            <Text style={styles.unassignedText}>⚠️ Not assigned to a space</Text>
          </View>
        )}
        
        <View style={styles.tagsContainer}>
          {item.tags?.slice(0, 3).map((tag, index) => (
            <View key={index} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
          {item.tags?.length > 3 && (
            <Text style={styles.moreTags}>+{item.tags.length - 3} more</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderItemDetail = () => {
    if (!selectedItem) return null;
    
    const hasSpace = selectedItem.assigned_space_id && selectedItem.spaces;
    
    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{selectedItem.item_name}</Text>
                <View style={styles.modalHeaderButtons}>
                  <TouchableOpacity 
                    onPress={() => handleDeleteItem(selectedItem)} 
                    style={styles.deleteButton}
                  >
                    <Text style={styles.deleteButtonText}>🗑️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
                    <Text style={styles.closeText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Item Photo */}
              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>📷 Item Photo</Text>
                {selectedItem.image_uri ? (
                  <Image
                    source={{ uri: selectedItem.image_uri }}
                    style={styles.itemImage}
                    resizeMode="cover"
                    onError={(e) => console.log('Item image load error:', e.nativeEvent.error)}
                  />
                ) : (
                  <View style={styles.noImagePlaceholder}>
                    <Text style={styles.noImagePlaceholderText}>📦 No photo</Text>
                  </View>
                )}
              </View>

              {hasSpace ? (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>📍 Current Location</Text>
                  <Text style={styles.detailValue}>{selectedItem.spaces.macro_space}</Text>
                  {selectedItem.spaces.micro_zone ? (
                    <Text style={styles.detailSubvalue}>{selectedItem.spaces.micro_zone}</Text>
                  ) : null}
                  {selectedItem.location_description && (
                    <Text style={styles.detailSubvalue}>📌 {selectedItem.location_description}</Text>
                  )}
                  {/* Space Photo */}
                  {selectedItem.spaces.image_uri ? (
                    <Image
                      source={{ uri: selectedItem.spaces.image_uri }}
                      style={styles.spaceImage}
                      resizeMode="cover"
                      onError={(e) => console.log('Space image load error:', e.nativeEvent.error)}
                    />
                  ) : (
                    <View style={styles.noSpaceImagePlaceholder}>
                      <Text style={styles.noSpaceImageText}>🗄️ No space photo</Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={[styles.detailSection, styles.unassignedSection]}>
                  <Text style={styles.detailLabel}>⚠️ Not Assigned</Text>
                  <Text style={styles.detailSubvalue}>
                    This item hasn't been assigned to a storage space yet.
                  </Text>
                </View>
              )}

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>💡 AI Recommendation</Text>
                <Text style={styles.detailRecommendation}>
                  {selectedItem.recommended_ideal_space || 'No recommendation available'}
                </Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>📋 Organization Tips</Text>
                <Text style={styles.detailTips}>
                  {selectedItem.organization_tips || 'No tips available'}
                </Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>🏷️ Search Tags</Text>
                <View style={styles.modalTagsContainer}>
                  {selectedItem.tags?.map((tag, index) => (
                    <View key={index} style={styles.modalTag}>
                      <Text style={styles.modalTagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <TouchableOpacity 
                style={styles.editItemButton} 
                onPress={() => {
                  closeModal();
                  openEditModal(selectedItem);
                }}
              >
                <Text style={styles.editItemButtonText}>✏️ Edit Name & Tags</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.assignButton} 
                onPress={() => {
                  closeModal();
                  openAssignModal(selectedItem);
                }}
              >
                <Text style={styles.assignButtonText}>
                  {hasSpace ? '📍 Change Space' : '📍 Assign to Space'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.closeModalButton} onPress={closeModal}>
                <Text style={styles.closeModalText}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Find Item</Text>
          <TouchableOpacity style={styles.viewToggle} onPress={toggleViewMode}>
            <Text style={styles.viewToggleText}>
              {viewMode === 'search' ? '📋 All Items' : '🔍 Search'}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>
          {viewMode === 'search' 
            ? (results.length > 0 ? `${results.length} result${results.length !== 1 ? 's' : ''}` : 'Search your inventory')
            : `${allItems.length} item${allItems.length !== 1 ? 's' : ''} total`
          }
        </Text>
      </View>

      {viewMode === 'search' ? (
        <>
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or tag..."
              placeholderTextColor="#999"
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
              <Text style={styles.searchButtonText}>🔍</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4A90D9" />
                <Text style={styles.loadingText}>Searching...</Text>
              </View>
            ) : !hasSearched ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🔍</Text>
                <Text style={styles.emptyTitle}>Search Your Inventory</Text>
                <Text style={styles.emptyText}>
                  Enter an item name or tag to find exactly where it's stored
                </Text>
              </View>
            ) : results.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>📭</Text>
                <Text style={styles.emptyTitle}>No Items Found</Text>
                <Text style={styles.emptyText}>
                  Try a different search term{'\n'}or organize a new item first
                </Text>
              </View>
            ) : (
              <FlatList
                data={results}
                keyExtractor={(item) => item.id}
                renderItem={renderResultItem}
                contentContainerStyle={styles.resultsList}
                refreshControl={
                  <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                }
              />
            )}
          </View>
        </>
      ) : (
        <View style={styles.content}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4A90D9" />
              <Text style={styles.loadingText}>Loading items...</Text>
            </View>
          ) : (
            <FlatList
              data={allItems}
              keyExtractor={(item) => item.id}
              renderItem={renderResultItem}
              contentContainerStyle={styles.resultsList}
            />
          )}
        </View>
      )}

      {renderItemDetail()}

      {/* Assign Space Modal — searchable hierarchical picker */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={assignModalVisible}
        onRequestClose={closeAssignModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.assignModalContent}>
            <View style={{ flex: 1 }}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign to Space</Text>
              <TouchableOpacity onPress={closeAssignModal} style={styles.closeButton}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle} numberOfLines={1}>
              Moving: "{assigningItem?.item_name}"
            </Text>

            {/* Search box */}
            <View style={styles.spaceSearchBox}>
              <Text style={styles.spaceSearchIcon}>🔍</Text>
              <TextInput
                style={styles.spaceSearchInput}
                placeholder="Search spaces..."
                placeholderTextColor="#999"
                value={spaceSearch}
                onChangeText={setSpaceSearch}
                autoCorrect={false}
                autoCapitalize="none"
              />
              {spaceSearch.length > 0 && (
                <TouchableOpacity onPress={() => setSpaceSearch('')}>
                  <Text style={styles.spaceSearchClear}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {spacesLoading ? (
              <View style={styles.emptySpaces}>
                <ActivityIndicator size="small" color="#4A90D9" />
                <Text style={[styles.emptySpacesSubtext, { marginTop: 10 }]}>Loading spaces...</Text>
              </View>
            ) : (
              <FlatList
                data={filteredSpaces}
                keyExtractor={(s) => s.id}
                style={styles.spacePickerList}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item: space }) => {
                  const isSearching = spaceSearch.trim().length > 0;
                  const isParent = space._isParent && !isSearching;
                  const isIndented = !!space.parent_id && !isSearching;
                  return (
                    <TouchableOpacity
                      style={[
                        styles.spacePickerRow,
                        isIndented && styles.spacePickerRowIndented,
                        isParent && styles.spacePickerRowParent,
                      ]}
                      onPress={() => handleAssignSpace(space)}
                    >
                      {isIndented ? (
                        <Text style={styles.spacePickerIndentIcon}>└ </Text>
                      ) : null}
                      <View style={styles.spacePickerInfo}>
                        {isSearching ? (
                          <Text style={styles.spacePickerBreadcrumb}>{space._label}</Text>
                        ) : (
                          <Text style={[
                            styles.spacePickerName,
                            isParent && styles.spacePickerNameParent,
                          ]}>
                            {isParent ? '📦 ' : '└🗄️ '}{space.macro_space}
                          </Text>
                        )}
                        {space.micro_zone ? (
                          <Text style={styles.spacePickerZone}>{space.micro_zone}</Text>
                        ) : null}
                        {space.additional_description ? (
                          <Text style={styles.spacePickerDesc} numberOfLines={1}>
                            {space.additional_description}
                          </Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  spacesFlat.length === 0 ? (
                    <View style={styles.emptySpaces}>
                      <Text style={styles.emptySpacesText}>No spaces yet</Text>
                      <Text style={styles.emptySpacesSubtext}>Create spaces in "My Spaces" first</Text>
                    </View>
                  ) : (
                    <View style={styles.emptySpaces}>
                      <Text style={styles.emptySpacesText}>No matches for "{spaceSearch}"</Text>
                      <Text style={styles.emptySpacesSubtext}>Try clearing the search to browse all</Text>
                    </View>
                  )
                }
              />
            )}

            </View>

            <TouchableOpacity style={styles.cancelAssignButton} onPress={closeAssignModal}>
              <Text style={styles.cancelAssignText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit Item Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={closeEditModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Item</Text>
              <TouchableOpacity onPress={closeEditModal} style={styles.closeButton}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.inputLabel}>Item Name</Text>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="Enter item name"
              maxLength={100}
            />

            <Text style={styles.inputLabel}>Tags (comma-separated)</Text>
            <TextInput
              style={styles.input}
              value={editTags}
              onChangeText={setEditTags}
              placeholder="e.g., electronics, small, portable"
              maxLength={200}
            />
            <Text style={styles.inputHint}>Separate tags with commas</Text>

            <View style={styles.editButtons}>
              <TouchableOpacity 
                style={[styles.editButton, styles.cancelEditButton]} 
                onPress={closeEditModal}
              >
                <Text style={styles.cancelEditText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.editButton, styles.saveEditButton]} 
                onPress={handleSaveEdit}
              >
                <Text style={styles.saveEditText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
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
  searchContainer: {
    flexDirection: 'row',
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  searchButton: {
    width: 50,
    height: 50,
    backgroundColor: '#4A90D9',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonText: {
    fontSize: 20,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#888',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyEmoji: {
    fontSize: 60,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    lineHeight: 24,
  },
  resultsList: {
    padding: 15,
  },
  resultCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  itemName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  locationContainer: {
    marginBottom: 12,
  },
  locationLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  locationText: {
    fontSize: 15,
    color: '#4A90D9',
    fontWeight: '600',
  },
  microText: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  unassignedBadge: {
    backgroundColor: '#FFF3CD',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  unassignedText: {
    fontSize: 13,
    color: '#856404',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  tag: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 12,
    color: '#1976D2',
  },
  moreTags: {
    fontSize: 12,
    color: '#888',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 10,
  },
  closeButton: {
    padding: 5,
  },
  closeText: {
    fontSize: 24,
    color: '#888',
  },
  modalHeaderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  deleteButton: {
    padding: 5,
  },
  deleteButtonText: {
    fontSize: 20,
  },
  detailSection: {
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  unassignedSection: {
    backgroundColor: '#FFF3CD',
    padding: 12,
    borderRadius: 8,
    borderBottomWidth: 0,
  },
  detailLabel: {
    fontSize: 12,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  detailValue: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
  },
  detailSubvalue: {
    fontSize: 15,
    color: '#666',
    marginTop: 4,
  },
  detailRecommendation: {
    fontSize: 15,
    color: '#4A90D9',
    lineHeight: 22,
    fontWeight: '500',
  },
  detailTips: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  modalTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modalTag: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  modalTagText: {
    fontSize: 13,
    color: '#1976D2',
    fontWeight: '500',
  },
  closeModalButton: {
    backgroundColor: '#4A90D9',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  closeModalText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Item Image
  imageSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  itemImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    resizeMode: 'cover',
  },
  noImagePlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
  },
  noImagePlaceholderText: {
    fontSize: 60,
  },
  // Space image in item detail
  spaceImage: {
    width: '100%',
    height: 150,
    borderRadius: 10,
    marginTop: 12,
    resizeMode: 'cover',
  },
  noSpaceImagePlaceholder: {
    width: '100%',
    height: 80,
    borderRadius: 10,
    marginTop: 12,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
  },
  noSpaceImageText: {
    fontSize: 14,
    color: '#999',
  },
  // Assign Button
  assignButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  assignButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Assign Modal
  assignModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 420,
    height: '85%',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 12,
  },
  spaceSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    backgroundColor: '#f9f9f9',
    paddingHorizontal: 10,
    marginBottom: 10,
    height: 42,
  },
  spaceSearchIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  spaceSearchInput: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    paddingVertical: 0,
  },
  spaceSearchClear: {
    fontSize: 16,
    color: '#aaa',
    paddingHorizontal: 4,
  },
  spacePickerList: {
    flexGrow: 1,
    flexShrink: 1,
  },
  spacePickerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#eee',
  },
  spacePickerRowParent: {
    backgroundColor: '#EEF4FF',
    borderColor: '#C5D8FF',
  },
  spacePickerRowIndented: {
    marginLeft: 16,
    backgroundColor: '#fff',
    borderColor: '#e0e8ff',
  },
  spacePickerIndentIcon: {
    fontSize: 15,
    color: '#aab',
    marginRight: 4,
    marginTop: 1,
  },
  spacePickerInfo: {
    flex: 1,
  },
  spacePickerBreadcrumb: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2a2a4a',
  },
  spacePickerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  spacePickerNameParent: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a3a7a',
  },
  spacePickerZone: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  spacePickerDesc: {
    fontSize: 11,
    color: '#aaa',
    marginTop: 1,
    fontStyle: 'italic',
  },
  emptySpaces: {
    alignItems: 'center',
    padding: 30,
  },
  emptySpacesText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  emptySpacesSubtext: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
  },
  cancelAssignButton: {
    backgroundColor: '#f0f0f0',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  cancelAssignText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewToggle: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  viewToggleText: {
    color: '#1976D2',
    fontSize: 14,
    fontWeight: '600',
  },
  // Edit Item Button
  editItemButton: {
    backgroundColor: '#FF9800',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  editItemButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Edit Modal
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  inputHint: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  editButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  editButton: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelEditButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelEditText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  saveEditButton: {
    backgroundColor: '#4CAF50',
  },
  saveEditText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
