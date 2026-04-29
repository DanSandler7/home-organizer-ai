/**
 * Database Service - Supabase Integration (Phase 2)
 * Full CRUD operations for Spaces and Items
 */

import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';
import * as FileSystem from 'expo-file-system/legacy';

// Initialize Supabase client
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

let supabase = null;

// Only initialize if keys are valid (not placeholder)
if (supabaseUrl && supabaseKey && 
    !supabaseUrl.includes('placeholder') && 
    !supabaseKey.includes('placeholder')) {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('[dbService] Supabase client initialized');
} else {
  console.warn('[dbService] Supabase not configured - using placeholder mode');
}

/**
 * Save a new space (Macro Space + Micro Zone) to the database
 * @param {Object} spaceData - The space data object
 * @param {string} spaceData.macroSpace - The macro space name
 * @param {string} spaceData.microZone - The micro zone name
 * @param {string|null} spaceData.additionalDescription - Optional additional description
 * @param {string|null} spaceData.imageUri - Optional image URI of the space
 * @param {string|null} spaceId - Optional ID for updating existing space
 * @returns {Promise<Object>} - The saved space record with id
 */
export async function saveSpace(spaceData, spaceId = null) {
  const { macroSpace, microZone, imageUri } = spaceData;
  
  if (!supabase) {
    console.warn('[dbService.saveSpace] Supabase not configured, using placeholder');
    return {
      id: spaceId || 'placeholder-' + Date.now(),
      macro_space: macroSpace,
      micro_zone: microZone,
      image_uri: imageUri,
      created_at: new Date().toISOString(),
    };
  }

  try {
    let data, error;
    
    const record = {
      macro_space: macroSpace,
      micro_zone: microZone,
      image_uri: imageUri,
    };
    
    if (spaceId) {
      // Update existing space
      ({ data, error } = await supabase
        .from('spaces')
        .update(record)
        .eq('id', spaceId)
        .select()
        .single());
    } else {
      // Insert new space
      ({ data, error } = await supabase
        .from('spaces')
        .insert([record])
        .select()
        .single());
    }
    
    if (error) throw error;
    console.log('[dbService.saveSpace] Saved:', data);
    return data;
  } catch (error) {
    console.error('[dbService.saveSpace] Error:', error);
    throw error;
  }
}

/**
 * Save a new item to the inventory
 * @param {Object} itemData - The item data object
 * @param {string} itemData.itemName - Name of the item
 * @param {string[]} itemData.tags - Array of fuzzy search tags
 * @param {string} itemData.recommendedIdealSpace - AI recommended ideal space description
 * @param {string} itemData.organizationTips - Expert organization tips from AI
 * @param {string|null} itemData.assignedSpaceId - Foreign key to spaces table (if assigned)
 * @param {string|null} itemData.imageUri - Image URI of the item
 * @returns {Promise<Object>} - The saved item record
 */
export async function saveItem({
  itemName,
  tags,
  recommendedIdealSpace,
  organizationTips,
  assignedSpaceId = null,
  imageUri = null,
  locationDescription = null,
}) {
  if (!supabase) {
    console.warn('[dbService.saveItem] Supabase not configured, using placeholder');
    return {
      id: 'placeholder-item-' + Date.now(),
      item_name: itemName,
      tags: tags,
      recommended_ideal_space: recommendedIdealSpace,
      organization_tips: organizationTips,
      assigned_space_id: assignedSpaceId,
      image_uri: imageUri,
      location_description: locationDescription,
      created_at: new Date().toISOString(),
    };
  }

  try {
    const { data, error } = await supabase
      .from('items')
      .insert([{
        item_name: itemName,
        tags: tags,
        recommended_ideal_space: recommendedIdealSpace,
        organization_tips: organizationTips,
        assigned_space_id: assignedSpaceId,
        image_uri: imageUri,
        location_description: locationDescription,
      }])
      .select()
      .single();
    
    if (error) throw error;
    console.log('[dbService.saveItem] Saved:', data);
    return data;
  } catch (error) {
    console.error('[dbService.saveItem] Error:', error);
    throw error;
  }
}

/**
 * Update an existing item
 * @param {string} itemId - The item ID to update
 * @param {Object} updates - The fields to update
 * @param {string} [updates.itemName] - New item name
 * @param {string[]} [updates.tags] - New tags array
 * @param {string} [updates.recommendedIdealSpace] - New recommended space
 * @param {string} [updates.organizationTips] - New organization tips
 * @param {string|null} [updates.assignedSpaceId] - New assigned space ID
 * @param {string|null} [updates.imageUri] - New image URI
 * @returns {Promise<Object>} - The updated item record
 */
export async function updateItem(itemId, updates) {
  if (!supabase) {
    console.warn('[dbService.updateItem] Supabase not configured, using placeholder');
    return {
      id: itemId,
      ...updates,
      updated_at: new Date().toISOString(),
    };
  }

  try {
    const updateData = {};
    if (updates.itemName !== undefined) updateData.item_name = updates.itemName;
    if (updates.tags !== undefined) updateData.tags = updates.tags;
    if (updates.recommendedIdealSpace !== undefined) updateData.recommended_ideal_space = updates.recommendedIdealSpace;
    if (updates.organizationTips !== undefined) updateData.organization_tips = updates.organizationTips;
    if (updates.assignedSpaceId !== undefined) updateData.assigned_space_id = updates.assignedSpaceId;
    if (updates.imageUri !== undefined) updateData.image_uri = updates.imageUri;

    const { data, error } = await supabase
      .from('items')
      .update(updateData)
      .eq('id', itemId)
      .select()
      .single();
    
    if (error) throw error;
    console.log('[dbService.updateItem] Updated:', data);
    return data;
  } catch (error) {
    console.error('[dbService.updateItem] Error:', error);
    throw error;
  }
}

/**
 * Search inventory by item name or tags
 * @param {string} query - Search query string
 * @returns {Promise<Array>} - Array of matching items with their assigned space info
 */
export async function searchInventory(query) {
  if (!supabase) {
    console.warn('[dbService.searchInventory] Supabase not configured, using placeholder');
    return [
      {
        id: 'placeholder-1',
        item_name: 'Sample Item (Placeholder Mode)',
        tags: ['sample', 'placeholder'],
        recommended_ideal_space: 'Configure Supabase to see real results',
        organization_tips: 'Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env',
        spaces: {
          macro_space: 'Demo Space',
          micro_zone: 'Demo Zone',
        },
      },
    ];
  }

  if (!query || query.trim() === '') {
    return [];
  }

  try {
    const q = query.trim().toLowerCase();
    const selectClause = `
      *,
      spaces:assigned_space_id (
        id,
        macro_space,
        micro_zone,
        parent_id,
        image_uri
      )
    `;

    // Fetch ALL items once, then filter client-side for full fuzzy matching
    // This avoids Supabase's lack of per-element array ilike support
    const { data: all, error } = await supabase
      .from('items')
      .select(selectClause)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const results = (all || []).filter(item => {
      if (item.item_name && item.item_name.toLowerCase().includes(q)) return true;
      if (item.recommended_ideal_space && item.recommended_ideal_space.toLowerCase().includes(q)) return true;
      if (item.organization_tips && item.organization_tips.toLowerCase().includes(q)) return true;
      if (Array.isArray(item.tags) && item.tags.some(tag => tag.toLowerCase().includes(q))) return true;
      return false;
    });

    console.log('[dbService.searchInventory] Found:', results.length, 'items for query:', query);
    return results;
  } catch (error) {
    console.error('[dbService.searchInventory] Error:', error);
    throw error;
  }
}

/**
 * Get all spaces
 * @returns {Promise<Array>} - Array of all spaces
 */
export async function getAllSpaces() {
  if (!supabase) {
    console.warn('[dbService.getAllSpaces] Supabase not configured, using placeholder');
    return [
      {
        id: 'placeholder-space-1',
        macro_space: 'Kitchen Pantry (Placeholder)',
        micro_zone: 'Top Shelf',
        image_uri: null,
      },
      {
        id: 'placeholder-space-2',
        macro_space: '1st Floor Hallway Closet #1 (Placeholder)',
        micro_zone: 'Bottom Drawer',
        image_uri: null,
      },
    ];
  }

  try {
    const { data, error } = await supabase
      .from('spaces')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    console.log('[dbService.getAllSpaces] Found:', data?.length || 0, 'spaces');
    return data || [];
  } catch (error) {
    console.error('[dbService.getAllSpaces] Error:', error);
    throw error;
  }
}

/**
 * Update an item's assigned space
 * @param {string} itemId - The item ID
 * @param {string|null} spaceId - The space ID to assign (null to unassign)
 * @returns {Promise<Object>} - The updated item
 */
export async function assignItemToSpace(itemId, spaceId) {
  if (!supabase) {
    console.warn('[dbService.assignItemToSpace] Supabase not configured, using placeholder');
    return {
      id: itemId,
      assigned_space_id: spaceId,
      updated: true,
    };
  }

  try {
    const { data, error } = await supabase
      .from('items')
      .update({ assigned_space_id: spaceId })
      .eq('id', itemId)
      .select()
      .single();
    
    if (error) throw error;
    console.log('[dbService.assignItemToSpace] Updated:', data);
    return data;
  } catch (error) {
    console.error('[dbService.assignItemToSpace] Error:', error);
    throw error;
  }
}

/**
 * Delete a space
 * @param {string} spaceId - The space ID to delete
 * @returns {Promise<void>}
 */
export async function deleteSpace(spaceId) {
  if (!supabase) {
    console.warn('[dbService.deleteSpace] Supabase not configured');
    return;
  }

  try {
    const { error } = await supabase
      .from('spaces')
      .delete()
      .eq('id', spaceId);
    
    if (error) throw error;
    console.log('[dbService.deleteSpace] Deleted:', spaceId);
  } catch (error) {
    console.error('[dbService.deleteSpace] Error:', error);
    throw error;
  }
}

/**
 * Get items in a specific space
 * @param {string} spaceId - The space ID
 * @returns {Promise<Array>} - Array of items in that space
 */
export async function getItemsInSpace(spaceId) {
  if (!supabase) {
    console.warn('[dbService.getItemsInSpace] Supabase not configured');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('assigned_space_id', spaceId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[dbService.getItemsInSpace] Error:', error);
    throw error;
  }
}

/**
 * Delete an item
 * @param {string} itemId - The item ID to delete
 * @returns {Promise<void>}
 */
export async function deleteItem(itemId) {
  if (!supabase) {
    console.warn('[dbService.deleteItem] Supabase not configured');
    return;
  }

  try {
    const { error } = await supabase
      .from('items')
      .delete()
      .eq('id', itemId);
    
    if (error) throw error;
    console.log('[dbService.deleteItem] Deleted:', itemId);
  } catch (error) {
    console.error('[dbService.deleteItem] Error:', error);
    throw error;
  }
}

/**
 * Save image to permanent app storage
 * @param {string} tempUri - Temporary image URI from camera
 * @param {string} type - 'item' or 'space'
 * @returns {Promise<string>} - Permanent URI
 */
export async function saveImagePermanently(tempUri, type = 'item') {
  try {
    console.log('[dbService.saveImagePermanently] Saving image:', tempUri);
    
    // Check if source file exists
    const sourceInfo = await FileSystem.getInfoAsync(tempUri);
    console.log('[dbService.saveImagePermanently] Source exists:', sourceInfo.exists, 'Size:', sourceInfo.size);
    
    if (!sourceInfo.exists) {
      throw new Error('Source file does not exist: ' + tempUri);
    }
    
    const filename = tempUri.split('/').pop() || `${Date.now()}.jpg`;
    const permanentDir = `${FileSystem.documentDirectory}images/${type}/`;
    const permanentUri = `${permanentDir}${filename}`;
    
    console.log('[dbService.saveImagePermanently] Target:', permanentUri);
    
    // Longer delay to ensure file is fully written (camera might still be flushing)
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Ensure directory exists
    const dirInfo = await FileSystem.getInfoAsync(permanentDir);
    if (!dirInfo.exists) {
      console.log('[dbService.saveImagePermanently] Creating directory:', permanentDir);
      await FileSystem.makeDirectoryAsync(permanentDir, { intermediates: true });
    }
    
    // Copy file to permanent location
    await FileSystem.copyAsync({
      from: tempUri,
      to: permanentUri,
    });
    
    // Verify copy succeeded
    const destInfo = await FileSystem.getInfoAsync(permanentUri);
    console.log('[dbService.saveImagePermanently] Dest exists:', destInfo.exists, 'Size:', destInfo.size);
    
    if (!destInfo.exists) {
      throw new Error('Copy failed - destination file does not exist');
    }
    
    console.log('[dbService.saveImagePermanently] Successfully saved to:', permanentUri);
    return permanentUri;
  } catch (error) {
    console.error('[dbService.saveImagePermanently] Error:', error.message);
    console.error('[dbService.saveImagePermanently] Stack:', error.stack);
    // Throw error so caller knows it failed - DON'T silently return temp URI
    throw error;
  }
}

/**
 * Get all items sorted alphabetically by name
 * @returns {Promise<Array>} - Array of all items sorted A-Z
 */
export async function getAllItemsAlphabetical() {
  if (!supabase) {
    console.warn('[dbService.getAllItemsAlphabetical] Supabase not configured');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('items')
      .select(`
        *,
        spaces:assigned_space_id (
          id,
          macro_space,
          micro_zone,
          parent_id,
          image_uri
        )
      `)
      .order('item_name', { ascending: true });
    
    if (error) throw error;
    console.log('[dbService.getAllItemsAlphabetical] Found:', data?.length || 0, 'items');
    return data || [];
  } catch (error) {
    console.error('[dbService.getAllItemsAlphabetical] Error:', error);
    throw error;
  }
}

/**
 * Check user's AI analysis tier and daily usage
 * @param {string} deviceId - Unique device identifier
 * @returns {Promise<Object>} - { hasAIPackage, analysesToday, analysesRemaining }
 */
export async function checkUserAITier(deviceId) {
  if (!supabase) {
    // Placeholder mode - locked by default for testing
    // Check if device was activated via promo code
    const isActivated = placeholderActivatedDevices.has(deviceId);
    return { 
      hasAIPackage: isActivated, 
      analysesToday: 0, 
      analysesRemaining: isActivated ? 10 : 0, 
      tier: isActivated ? 'premium' : 'base' 
    };
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Get or create user record
    const { data: userData, error: userError } = await supabase
      .from('user_tiers')
      .select('*')
      .eq('device_id', deviceId)
      .single();
    
    if (userError && userError.code !== 'PGRST116') {
      throw userError;
    }
    
    // New user - create record
    if (!userData) {
      const { data: newUser, error: createError } = await supabase
        .from('user_tiers')
        .insert([{
          device_id: deviceId,
          tier: 'base',
          ai_package: false,
          ai_analyses_today: 0,
          ai_last_analysis_date: today,
        }])
        .select()
        .single();
      
      if (createError) throw createError;
      
      return { 
        hasAIPackage: false, 
        analysesToday: 0, 
        analysesRemaining: 0,
        tier: 'base'
      };
    }
    
    // Reset daily counter if it's a new day
    if (userData.ai_last_analysis_date !== today) {
      const { error: updateError } = await supabase
        .from('user_tiers')
        .update({
          ai_analyses_today: 0,
          ai_last_analysis_date: today,
        })
        .eq('device_id', deviceId);
      
      if (updateError) throw updateError;
      
      return { 
        hasAIPackage: userData.ai_package, 
        analysesToday: 0, 
        analysesRemaining: userData.ai_package ? 10 : 0,
        tier: userData.tier
      };
    }
    
    return { 
      hasAIPackage: userData.ai_package, 
      analysesToday: userData.ai_analyses_today, 
      analysesRemaining: userData.ai_package ? Math.max(0, 10 - userData.ai_analyses_today) : 0,
      tier: userData.tier
    };
    
  } catch (error) {
    // Silently handle missing table error - fall back to placeholder mode
    if (error.code === 'PGRST205' || error.message?.includes('could not find')) {
      console.log('[dbService.checkUserAITier] user_tiers table not found, using placeholder mode');
      const isActivated = placeholderActivatedDevices.has(deviceId);
      return { 
        hasAIPackage: isActivated, 
        analysesToday: 0, 
        analysesRemaining: isActivated ? 10 : 0, 
        tier: isActivated ? 'premium' : 'base' 
      };
    }
    
    // Log other errors but don't crash
    console.log('[dbService.checkUserAITier] Using fallback mode');
    return { hasAIPackage: false, analysesToday: 0, analysesRemaining: 0, tier: 'base' };
  }
}

/**
 * Record an AI analysis usage
 * @param {string} deviceId - Unique device identifier
 * @returns {Promise<boolean>} - Success
 */
export async function recordAIAnalysis(deviceId) {
  if (!supabase) return true; // Placeholder mode
  
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Fetch current count first
    const { data, error: fetchError } = await supabase
      .from('user_tiers')
      .select('ai_analyses_today, ai_last_analysis_date')
      .eq('device_id', deviceId)
      .single();
    
    if (fetchError) throw fetchError;
    
    // Reset count if it's a new day, otherwise increment
    const isNewDay = data.ai_last_analysis_date !== today;
    const newCount = isNewDay ? 1 : (data.ai_analyses_today || 0) + 1;
    
    const { error: updateError } = await supabase
      .from('user_tiers')
      .update({
        ai_analyses_today: newCount,
        ai_last_analysis_date: today,
      })
      .eq('device_id', deviceId);
    
    if (updateError) throw updateError;
    return true;
    
  } catch (error) {
    console.log('[dbService.recordAIAnalysis] Could not record usage:', error.message);
    return false;
  }
}

/**
 * Activate AI package for user (after payment)
 * @param {string} deviceId - Unique device identifier
 * @param {string} promoCode - Optional promo code
 * @returns {Promise<boolean>} - Success
 */
// Simple in-memory store for placeholder mode
const placeholderPromoCodes = new Set();
const placeholderActivatedDevices = new Set();

export async function activateAIPackage(deviceId, promoCode = null) {
  // Placeholder mode - accept any promo code starting with FRIEND-, BETA-, VIP-, or RESERVE-
  if (!supabase) {
    const validPrefixes = ['FRIEND-', 'BETA-', 'VIP-', 'RESERVE-'];
    const isValidFormat = validPrefixes.some(prefix => 
      promoCode && promoCode.toUpperCase().startsWith(prefix)
    );
    
    if (!isValidFormat) {
      console.log('[dbService.activateAIPackage] Invalid promo code format:', promoCode);
      return false;
    }
    
    // Check if code was already used
    const upperCode = promoCode.toUpperCase();
    if (placeholderPromoCodes.has(upperCode)) {
      console.log('[dbService.activateAIPackage] Code already used:', upperCode);
      return false;
    }
    
    // Mark code as used and activate device
    placeholderPromoCodes.add(upperCode);
    placeholderActivatedDevices.add(deviceId);
    console.log('[dbService.activateAIPackage] Promo code activated in placeholder mode:', upperCode);
    return true;
  }
  
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Validate promo code if provided
    let tier = 'premium';
    if (promoCode) {
      const { data: promoData, error: promoError } = await supabase
        .from('promo_codes')
        .select('*')
        .eq('code', promoCode.toUpperCase())
        .eq('active', true)
        .single();
      
      if (promoData && !promoError) {
        tier = promoData.tier || 'premium';
      } else {
        return false; // Invalid code
      }
    }
    
    const { error } = await supabase
      .from('user_tiers')
      .upsert({
        device_id: deviceId,
        tier: tier,
        ai_package: true,
        ai_analyses_today: 0,
        ai_last_analysis_date: today,
      });
    
    if (error) throw error;
    return true;
    
  } catch (error) {
    console.error('[dbService.activateAIPackage] Error:', error);
    // If table doesn't exist, fall back to placeholder mode
    if (error.code === 'PGRST205' || error.message?.includes('could not find')) {
      const validPrefixes = ['FRIEND-', 'BETA-', 'VIP-', 'RESERVE-'];
      const isValidFormat = validPrefixes.some(prefix => 
        promoCode && promoCode.toUpperCase().startsWith(prefix)
      );
      if (isValidFormat) {
        const upperCode = promoCode.toUpperCase();
        if (!placeholderPromoCodes.has(upperCode)) {
          placeholderPromoCodes.add(upperCode);
          placeholderActivatedDevices.add(deviceId);
          return true;
        }
      }
    }
    return false;
  }
}

/**
 * Request free access (for friends/family approval)
 * @param {string} deviceId - Unique device identifier
 * @param {string} email - User's email address
 * @param {string} name - User's name
 * @param {string} message - Optional message
 * @returns {Promise<boolean>} - Success
 */
export async function requestFreeAccess(deviceId, email, name, message = '') {
  if (!supabase) return true;
  
  try {
    const { error } = await supabase
      .from('access_requests')
      .insert([{
        device_id: deviceId,
        email: email,
        name: name,
        message: message,
        status: 'pending',
        created_at: new Date().toISOString(),
      }]);
    
    if (error) throw error;
    
    // Also send notification to admin (you'd set up an email service here)
    console.log('[dbService.requestFreeAccess] Access request submitted:', email);
    
    return true;
    
  } catch (error) {
    console.error('[dbService.requestFreeAccess] Error:', error);
    return false;
  }
}

/**
 * Check if access request was approved
 * @param {string} deviceId - Unique device identifier
 * @returns {Promise<Object>} - { approved: boolean, tier: string }
 */
export async function checkAccessRequestStatus(deviceId) {
  if (!supabase) return { approved: false, tier: 'base' };
  
  try {
    const { data, error } = await supabase
      .from('access_requests')
      .select('*')
      .eq('device_id', deviceId)
      .eq('status', 'approved')
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    
    if (data) {
      return { approved: true, tier: data.granted_tier || 'premium' };
    }
    
    return { approved: false, tier: 'base' };
    
  } catch (error) {
    console.error('[dbService.checkAccessRequestStatus] Error:', error);
    return { approved: false, tier: 'base' };
  }
}

// ─────────────────────────────────────────────────────────────
// HIERARCHICAL SPACES
// ─────────────────────────────────────────────────────────────

/**
 * Get all top-level spaces (no parent)
 * @returns {Promise<Array>}
 */
export async function getTopLevelSpaces() {
  if (!supabase) {
    return [
      { id: 'placeholder-space-1', macro_space: 'Kitchen (Placeholder)', micro_zone: '', image_uri: null, parent_id: null },
    ];
  }

  try {
    const { data, error } = await supabase
      .from('spaces')
      .select('*')
      .is('parent_id', null)
      .order('created_at', { ascending: true });

    if (error) throw error;
    console.log('[dbService.getTopLevelSpaces] Found:', data?.length || 0);
    return data || [];
  } catch (error) {
    console.error('[dbService.getTopLevelSpaces] Error:', error);
    throw error;
  }
}

/**
 * Get all sub-locations (children) of a parent space
 * @param {string} parentId - The parent space ID
 * @returns {Promise<Array>}
 */
export async function getSubLocations(parentId) {
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('spaces')
      .select('*')
      .eq('parent_id', parentId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    console.log('[dbService.getSubLocations] Found:', data?.length || 0, 'for parent:', parentId);
    return data || [];
  } catch (error) {
    console.error('[dbService.getSubLocations] Error:', error);
    throw error;
  }
}

/**
 * Get all spaces with their full hierarchy (parents + children) in one query
 * Returns a flat list; call buildSpaceTree() on client to group them
 * @returns {Promise<Array>}
 */
export async function getAllSpacesHierarchical() {
  if (!supabase) {
    return [
      { id: 'placeholder-space-1', macro_space: 'Kitchen (Placeholder)', micro_zone: '', image_uri: null, parent_id: null },
    ];
  }

  try {
    const { data, error } = await supabase
      .from('spaces')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw error;
    console.log('[dbService.getAllSpacesHierarchical] Found:', data?.length || 0);
    return data || [];
  } catch (error) {
    console.error('[dbService.getAllSpacesHierarchical] Error:', error);
    throw error;
  }
}

/**
 * Build a nested tree from a flat list of spaces
 * Each parent node gets a `children` array of its direct sub-locations
 * @param {Array} flatList - Flat array from getAllSpacesHierarchical()
 * @returns {Array} - Array of root nodes, each with .children[]
 */
export function buildSpaceTree(flatList) {
  const map = {};
  flatList.forEach(s => { map[s.id] = { ...s, children: [] }; });

  const roots = [];
  flatList.forEach(s => {
    if (s.parent_id && map[s.parent_id]) {
      map[s.parent_id].children.push(map[s.id]);
    } else {
      roots.push(map[s.id]);
    }
  });
  return roots;
}

/**
 * Save a space (supports parent_id for sub-locations)
 * Extends the existing saveSpace() — use this going forward
 * @param {Object} spaceData
 * @param {string|null} spaceData.macroSpace
 * @param {string|null} spaceData.microZone
 * @param {string|null} spaceData.additionalDescription
 * @param {string|null} spaceData.imageUri
 * @param {string|null} spaceData.parentId  - NEW: parent space ID for sub-locations
 * @param {string|null} spaceId - If provided, update existing record
 * @returns {Promise<Object>}
 */
export async function saveSpaceHierarchical(spaceData, spaceId = null) {
  const { macroSpace, microZone, additionalDescription, imageUri, parentId = null } = spaceData;

  if (!supabase) {
    return {
      id: spaceId || 'placeholder-' + Date.now(),
      macro_space: macroSpace,
      micro_zone: microZone || '',
      additional_description: additionalDescription || null,
      image_uri: imageUri || null,
      parent_id: parentId,
      created_at: new Date().toISOString(),
    };
  }

  try {
    const record = {
      macro_space: macroSpace,
      micro_zone: microZone || '',
      additional_description: additionalDescription || null,
      image_uri: imageUri || null,
      parent_id: parentId,
    };

    let data, error;
    if (spaceId) {
      ({ data, error } = await supabase
        .from('spaces')
        .update(record)
        .eq('id', spaceId)
        .select()
        .single());
    } else {
      ({ data, error } = await supabase
        .from('spaces')
        .insert([record])
        .select()
        .single());
    }

    if (error) throw error;
    console.log('[dbService.saveSpaceHierarchical] Saved:', data);
    return data;
  } catch (error) {
    console.error('[dbService.saveSpaceHierarchical] Error:', error);
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────
// GUIDES
// ─────────────────────────────────────────────────────────────

/**
 * Save a new guide entry
 * @param {Object} guideData
 * @param {string} guideData.title
 * @param {string} guideData.content
 * @param {string|null} guideData.sourceLabel - e.g. "The Life-Changing Magic of Tidying Up"
 * @returns {Promise<Object>}
 */
export async function saveGuide({ title, content, sourceLabel = null }) {
  if (!supabase) {
    return {
      id: 'placeholder-guide-' + Date.now(),
      title,
      content,
      source_label: sourceLabel,
      created_at: new Date().toISOString(),
    };
  }

  try {
    const { data, error } = await supabase
      .from('guides')
      .insert([{ title, content, source_label: sourceLabel }])
      .select()
      .single();

    if (error) throw error;
    console.log('[dbService.saveGuide] Saved:', data.id);
    return data;
  } catch (error) {
    console.error('[dbService.saveGuide] Error:', error);
    throw error;
  }
}

/**
 * Update an existing guide
 * @param {string} guideId
 * @param {Object} updates - { title, content, sourceLabel }
 * @returns {Promise<Object>}
 */
export async function updateGuide(guideId, { title, content, sourceLabel }) {
  if (!supabase) return { id: guideId, title, content, source_label: sourceLabel };

  try {
    const { data, error } = await supabase
      .from('guides')
      .update({ title, content, source_label: sourceLabel })
      .eq('id', guideId)
      .select()
      .single();

    if (error) throw error;
    console.log('[dbService.updateGuide] Updated:', data.id);
    return data;
  } catch (error) {
    console.error('[dbService.updateGuide] Error:', error);
    throw error;
  }
}

/**
 * Get all guides
 * @returns {Promise<Array>}
 */
export async function getAllGuides() {
  if (!supabase) {
    return [
      {
        id: 'placeholder-guide-1',
        title: 'Sample Guide (Placeholder)',
        content: 'Keep only things that spark joy. Store items by category, not by room.',
        source_label: 'KonMari Method',
        created_at: new Date().toISOString(),
      },
    ];
  }

  try {
    const { data, error } = await supabase
      .from('guides')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    console.log('[dbService.getAllGuides] Found:', data?.length || 0);
    return data || [];
  } catch (error) {
    console.error('[dbService.getAllGuides] Error:', error);
    throw error;
  }
}

/**
 * Delete a guide
 * @param {string} guideId
 * @returns {Promise<void>}
 */
export async function deleteGuide(guideId) {
  if (!supabase) return;

  try {
    const { error } = await supabase
      .from('guides')
      .delete()
      .eq('id', guideId);

    if (error) throw error;
    console.log('[dbService.deleteGuide] Deleted:', guideId);
  } catch (error) {
    console.error('[dbService.deleteGuide] Error:', error);
    throw error;
  }
}

/**
 * Get all guides and return their content concatenated for AI prompt injection
 * @returns {Promise<string>} - Combined guide text ready for prompt
 */
export async function getGuidesForPrompt() {
  try {
    const guides = await getAllGuides();
    if (!guides || guides.length === 0) return '';

    return guides
      .map(g => `### ${g.title}${g.source_label ? ` (${g.source_label})` : ''}\n${g.content}`)
      .join('\n\n');
  } catch (error) {
    console.error('[dbService.getGuidesForPrompt] Error:', error);
    return '';
  }
}
