import { GoogleGenerativeAI } from '@google/generative-ai';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * AI Service - Google Gemini Vision Integration
 * Uses gemini-1.5-flash for item analysis and organization recommendations
 */

// Initialize the Gemini API client
const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY?.trim();

console.log('[aiService] Gemini API Key available:', !!apiKey);
console.log('[aiService] Gemini API Key length:', apiKey?.length);
console.log('[aiService] Gemini API Key starts with AIza:', apiKey?.startsWith('AIza'));
console.log('[aiService] Gemini API includes placeholder:', apiKey?.includes('placeholder'));

let genAI = null;
if (apiKey && !apiKey.includes('placeholder') && apiKey !== 'your_gemini_api_key_here') {
  try {
    genAI = new GoogleGenerativeAI(apiKey);
    console.log('[aiService] Gemini client initialized');
  } catch (err) {
    console.error('[aiService] Failed to initialize Gemini:', err.message);
  }
} else {
  console.warn('[aiService] Gemini API not configured - using placeholder mode');
}

/**
 * Convert a file URI to base64 for Gemini API
 * @param {string} uri - Local file URI
 * @returns {Promise<{data: string, mimeType: string}>}
 */
async function fileToGenerativePart(uri) {
  try {
    // Read file as base64
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64',
    });
    
    // Determine mime type from extension
    const extension = uri.split('.').pop()?.toLowerCase() || 'jpeg';
    const mimeType = extension === 'png' ? 'image/png' : 'image/jpeg';
    
    return {
      inlineData: {
        data: base64,
        mimeType: mimeType,
      },
    };
  } catch (error) {
    console.error('[aiService] Error reading file:', error);
    throw new Error('Failed to read image file: ' + error.message);
  }
}

/**
 * Analyze an item image using Gemini Vision
 * Returns structured JSON with: item_name, tags, recommended_ideal_space, organization_tips
 * 
 * @param {string} imageUri - Local image URI from camera
 * @returns {Promise<Object>} - Structured analysis result
 * 
 * Response format:
 * {
 *   item_name: string,
 *   tags: string[],
 *   recommended_ideal_space: string,
 *   organization_tips: string
 * }
 */
export async function analyzeItem(imageUri) {
  // Check if API is configured
  if (!genAI) {
    console.warn('[aiService.analyzeItem] Gemini API not configured, returning placeholder');
    return getPlaceholderAnalysis();
  }

  try {
    // Get the generative model (gemini-1.5-flash is free tier)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    // Prepare the image
    const imagePart = await fileToGenerativePart(imageUri);

    // Craft the prompt for structured output
    const prompt = `
You are an expert home organization assistant. Analyze this household item and provide detailed organization recommendations.

Identify the item and return a STRICTLY FORMATTED JSON object with the following fields:

{
  "item_name": "The specific, clear name of the item (e.g., 'Ceramic Coffee Mug', 'Wool Throw Blanket')",
  "tags": ["array", "of", "searchable", "keywords", "for", "fuzzy", "search"],
  "recommended_ideal_space": "The IDEAL recommended storage location regardless of whether it exists. Be specific with conditions (e.g., 'Cool, dark pantry shelf away from heat sources' or 'Bathroom cabinet under sink, stackable with similar containers')",
  "organization_tips": "Expert organization advice including: stacking rules, temperature/humidity control, accessibility recommendations, and any safety considerations. Be concise but thorough."
}

Important:
- The recommended_ideal_space should be the OPTIMAL location, even if the user hasn't mapped that space yet
- Include 5-8 relevant tags for searchability (material, use case, category, etc.). Use COMPLETE WORDS only (e.g., "puzzle" not "puzzl", "vase" not "vas", "ceramic" not "cerami")
- Organization tips should be practical and research-backed
- Return ONLY the JSON object, no markdown, no explanation
`;

    // Generate content
    const result = await model.generateContent([prompt, imagePart]);
    const response = result.response;
    const text = response.text();

    // Parse the JSON response
    // Gemini sometimes wraps in markdown code blocks, so handle both cases
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || 
                      text.match(/```\s*([\s\S]*?)\s*```/) ||
                      [null, text];
    
    const jsonString = jsonMatch[1] || text;
    const parsedResult = JSON.parse(jsonString.trim());

    // Validate required fields
    if (!parsedResult.item_name || !parsedResult.tags || !parsedResult.recommended_ideal_space) {
      throw new Error('Incomplete response from AI - missing required fields');
    }

    return {
      itemName: parsedResult.item_name,
      tags: parsedResult.tags,
      recommendedIdealSpace: parsedResult.recommended_ideal_space,
      organizationTips: parsedResult.organization_tips || '',
    };

  } catch (error) {
    console.error('[aiService.analyzeItem] Error:', error);
    
    // Return placeholder on error so UI doesn't crash
    return {
      ...getPlaceholderAnalysis(),
      error: error.message,
    };
  }
}

/**
 * Get placeholder analysis for development/testing
 * @returns {Object} - Placeholder analysis result
 */
function getPlaceholderAnalysis() {
  return {
    itemName: 'Sample Household Item (API Not Configured)',
    tags: ['sample', 'household', 'item', 'placeholder', 'storage', 'organization'],
    recommendedIdealSpace: 'Climate-controlled storage area, away from direct sunlight',
    organizationTips: 'Store in a cool, dry place. Keep away from heat sources. Consider using airtight containers for long-term storage. Label clearly for easy retrieval.',
    isPlaceholder: true,
  };
}

/**
 * Test function to verify Gemini API connectivity
 * @returns {Promise<boolean>} - True if API is working
 */
export async function testGeminiAPI() {
  if (!genAI) {
    return false;
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    const result = await model.generateContent('Say "AI Home Organizer is ready" and return only that text.');
    const text = result.response.text();
    console.log('[aiService.testGeminiAPI] Success:', text);
    return true;
  } catch (error) {
    console.error('[aiService.testGeminiAPI] Failed:', error);
    return false;
  }
}

/**
 * Category-specific importance questions
 * Each category has 2-3 multiple choice questions to determine item priority
 */
const IMPORTANCE_QUESTIONS = {
  medicine: {
    category: 'Medicine/Health',
    questions: [
      {
        id: 'expired',
        question: 'Is this medicine expired?',
        options: [
          { value: 'yes', label: 'Yes, expired', score: -10 },
          { value: 'no', label: 'No, still valid', score: 0 },
          { value: 'unsure', label: 'Not sure', score: -2 },
        ],
      },
      {
        id: 'frequency',
        question: 'How often do you use this?',
        options: [
          { value: 'daily', label: 'Daily/Weekly', score: 10 },
          { value: 'monthly', label: 'Monthly', score: 5 },
          { value: 'rarely', label: 'Rarely/As needed', score: 2 },
          { value: 'never', label: 'Never used it', score: -5 },
        ],
      },
      {
        id: 'essential',
        question: 'Is this essential for health/emergencies?',
        options: [
          { value: 'critical', label: 'Critical (life-saving)', score: 10 },
          { value: 'important', label: 'Important', score: 5 },
          { value: 'minor', label: 'Minor ailment', score: 2 },
          { value: 'unnecessary', label: 'Not needed', score: -3 },
        ],
      },
    ],
  },
  electronics: {
    category: 'Electronics/Tech',
    questions: [
      {
        id: 'working',
        question: 'Is this item working properly?',
        options: [
          { value: 'yes', label: 'Yes, works great', score: 5 },
          { value: 'mostly', label: 'Mostly works', score: 2 },
          { value: 'broken', label: 'Broken/Damaged', score: -8 },
          { value: 'unsure', label: 'Haven\'t tested', score: -1 },
        ],
      },
      {
        id: 'frequency',
        question: 'How often do you use this?',
        options: [
          { value: 'daily', label: 'Daily', score: 10 },
          { value: 'weekly', label: 'Weekly', score: 7 },
          { value: 'monthly', label: 'Monthly', score: 4 },
          { value: 'rarely', label: 'Rarely/Never', score: -3 },
        ],
      },
      {
        id: 'replaceable',
        question: 'Is this easily replaceable if needed?',
        options: [
          { value: 'hard', label: 'Hard to replace/Unique', score: 5 },
          { value: 'moderate', label: 'Moderate effort', score: 2 },
          { value: 'easy', label: 'Easily replaceable', score: -2 },
          { value: 'obsolete', label: 'Obsolete tech', score: -5 },
        ],
      },
    ],
  },
  clothing: {
    category: 'Clothing/Apparel',
    questions: [
      {
        id: 'fits',
        question: 'Does this still fit you?',
        options: [
          { value: 'perfect', label: 'Perfect fit', score: 5 },
          { value: 'ok', label: 'It\'s okay', score: 2 },
          { value: 'small', label: 'Too small/large', score: -5 },
          { value: 'unsure', label: 'Haven\'t tried', score: 0 },
        ],
      },
      {
        id: 'worn',
        question: 'Have you worn this in the last year?',
        options: [
          { value: 'week', label: 'Within a week', score: 10 },
          { value: 'month', label: 'Within a month', score: 7 },
          { value: 'year', label: 'Within a year', score: 3 },
          { value: 'never', label: 'Over a year/Never', score: -5 },
        ],
      },
      {
        id: 'sentimental',
        question: 'Any sentimental or special value?',
        options: [
          { value: 'high', label: 'Very sentimental', score: 5 },
          { value: 'some', label: 'Some value', score: 2 },
          { value: 'functional', label: 'Just functional', score: 0 },
          { value: 'none', label: 'No attachment', score: -2 },
        ],
      },
    ],
  },
  documents: {
    category: 'Documents/Papers',
    questions: [
      {
        id: 'important',
        question: 'How important is this document?',
        options: [
          { value: 'critical', label: 'Critical (legal ID, will, etc.)', score: 10 },
          { value: 'important', label: 'Important (contracts, tax)', score: 7 },
          { value: 'reference', label: 'Reference material', score: 3 },
          { value: 'junk', label: 'Junk mail/Old receipts', score: -5 },
        ],
      },
      {
        id: 'digital',
        question: 'Do you have a digital backup?',
        options: [
          { value: 'yes', label: 'Yes, backed up', score: 2 },
          { value: 'no', label: 'No backup (original only)', score: 5 },
          { value: 'should', label: 'Should digitize', score: 3 },
        ],
      },
      {
        id: 'access',
        question: 'How often do you need to access this?',
        options: [
          { value: 'regular', label: 'Regularly', score: 8 },
          { value: 'yearly', label: 'Yearly/Tax season', score: 5 },
          { value: 'emergency', label: 'Emergency only', score: 3 },
          { value: 'never', label: 'Probably never', score: -3 },
        ],
      },
    ],
  },
  kitchen: {
    category: 'Kitchen/Food',
    questions: [
      {
        id: 'expired',
        question: 'Is this expired or spoiled?',
        options: [
          { value: 'fresh', label: 'Fresh/Good', score: 0 },
          { value: 'soon', label: 'Expires soon', score: 3 },
          { value: 'expired', label: 'Expired', score: -10 },
          { value: 'unsure', label: 'Not sure', score: -2 },
        ],
      },
      {
        id: 'frequency',
        question: 'How often do you use this?',
        options: [
          { value: 'daily', label: 'Daily', score: 10 },
          { value: 'weekly', label: 'Weekly', score: 6 },
          { value: 'rarely', label: 'Rarely/Special occasions', score: 2 },
          { value: 'never', label: 'Never used', score: -5 },
        ],
      },
      {
        id: 'duplicates',
        question: 'Do you have duplicates of this item?',
        options: [
          { value: 'only', label: 'Only one', score: 3 },
          { value: 'few', label: 'A few', score: 1 },
          { value: 'many', label: 'Too many/Excess', score: -3 },
          { value: 'set', label: 'Part of set', score: 2 },
        ],
      },
    ],
  },
  seasonal: {
    category: 'Seasonal/Holiday',
    questions: [
      {
        id: 'condition',
        question: 'What\'s the condition?',
        options: [
          { value: 'excellent', label: 'Like new', score: 5 },
          { value: 'good', label: 'Good', score: 3 },
          { value: 'worn', label: 'Worn/Used', score: 0 },
          { value: 'damaged', label: 'Damaged', score: -5 },
        ],
      },
      {
        id: 'used',
        question: 'Do you actually use this every season?',
        options: [
          { value: 'always', label: 'Always', score: 7 },
          { value: 'usually', label: 'Usually', score: 4 },
          { value: 'rarely', label: 'Rarely', score: -2 },
          { value: 'never', label: 'Never display it', score: -5 },
        ],
      },
      {
        id: 'storage',
        question: 'Size for storage consideration?',
        options: [
          { value: 'small', label: 'Small (easy to store)', score: 2 },
          { value: 'medium', label: 'Medium', score: 0 },
          { value: 'large', label: 'Large (takes space)', score: -2 },
          { value: 'huge', label: 'Huge/bulky', score: -4 },
        ],
      },
    ],
  },
  default: {
    category: 'General Item',
    questions: [
      {
        id: 'condition',
        question: 'What\'s the condition of this item?',
        options: [
          { value: 'excellent', label: 'Excellent', score: 5 },
          { value: 'good', label: 'Good', score: 3 },
          { value: 'fair', label: 'Fair/Worn', score: 0 },
          { value: 'poor', label: 'Poor/Damaged', score: -5 },
        ],
      },
      {
        id: 'frequency',
        question: 'How often do you use this?',
        options: [
          { value: 'daily', label: 'Daily', score: 10 },
          { value: 'weekly', label: 'Weekly', score: 6 },
          { value: 'monthly', label: 'Monthly', score: 3 },
          { value: 'rarely', label: 'Rarely/Never', score: -3 },
        ],
      },
      {
        id: 'value',
        question: 'What\'s the value/importance to you?',
        options: [
          { value: 'high', label: 'High value/Sentimental', score: 5 },
          { value: 'moderate', label: 'Moderate value', score: 2 },
          { value: 'low', label: 'Low value', score: -1 },
          { value: 'none', label: 'Could toss it', score: -3 },
        ],
      },
    ],
  },
};

/**
 * Determine category based on AI analysis tags and item name
 */
function determineCategory(itemName, tags) {
  const text = (itemName + ' ' + tags.join(' ')).toLowerCase();
  
  if (text.match(/medicine|pill|drug|vitamin|prescription|inhaler|epipen|insulin/)) {
    return 'medicine';
  }
  if (text.match(/phone|laptop|computer|camera|cable|charger|battery|electronics|tv|remote/)) {
    return 'electronics';
  }
  if (text.match(/shirt|pants|dress|shoe|jacket|coat|sweater|clothing|apparel|hat|scarf/)) {
    return 'clothing';
  }
  if (text.match(/document|paper|file|receipt|contract|certificate|passport|tax|bill/)) {
    return 'documents';
  }
  if (text.match(/food|pan|pot|dish|utensil|spice|appliance|kitchen|cook|plate|bowl/)) {
    return 'kitchen';
  }
  if (text.match(/christmas|halloween|decoration|ornament|seasonal|holiday|wreath|light/)) {
    return 'seasonal';
  }
  
  return 'default';
}

/**
 * Get importance questions for an item based on AI analysis
 * @param {Object} aiResult - The result from analyzeItem
 * @returns {Object} - Category and questions array
 */
export function getImportanceQuestions(aiResult) {
  const category = determineCategory(aiResult.itemName, aiResult.tags);
  const template = IMPORTANCE_QUESTIONS[category] || IMPORTANCE_QUESTIONS.default;
  
  return {
    category: template.category,
    categoryKey: category,
    questions: template.questions,
  };
}

/**
 * Get smart AI suggestions for an item using Guides and user's actual spaces
 * Called after analyzeItem() completes, before the user picks a space
 *
 * @param {Object} aiResult         - Result from analyzeItem()
 * @param {Array}  userSpaces       - Flat array of all user spaces from getAllSpacesHierarchical()
 * @param {string} guidesText       - Combined guide text from getGuidesForPrompt()
 * @returns {Promise<Object>} - { bestSpace, suggestedOrganizer, keepOrDiscard, reasoning }
 */
export async function getSmartSuggestion(aiResult, userSpaces, guidesText) {
  if (!genAI) {
    return getPlaceholderSuggestion(aiResult, userSpaces);
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    // Build a readable list of the user's actual spaces
    const spacesList = userSpaces.length > 0
      ? userSpaces.map((s, i) => {
          const label = s.macro_space + (s.micro_zone ? ` › ${s.micro_zone}` : '') + (s.additional_description ? ` (${s.additional_description})` : '');
          return `${i + 1}. [ID: ${s.id}] ${label}`;
        }).join('\n')
      : 'No spaces mapped yet.';

    const guidesSection = guidesText
      ? `\n\nORGANIZATION GUIDES (use these principles in your reasoning):\n${guidesText}`
      : '';

    const prompt = `
You are an expert home organization consultant. Your job is to give a concise, practical recommendation for storing a specific item.

ITEM BEING ORGANIZED:
- Name: ${aiResult.itemName}
- Tags: ${aiResult.tags?.join(', ') || 'none'}
- General recommendation from AI: ${aiResult.recommendedIdealSpace}
- Organization tips: ${aiResult.organizationTips || 'none'}
${guidesSection}

USER'S ACTUAL MAPPED STORAGE SPACES:
${spacesList}

Based on the item, the organizing principles from the guides, and the user's real spaces, return a STRICTLY FORMATTED JSON object:

{
  "best_space_id": "The ID of the single best matching space from the list above, or null if none are suitable",
  "best_space_label": "The human-readable name of that space, or a description of the ideal space if none matched",
  "suggested_organizer": "A specific type of organizer or container that would work best in that space for this item (e.g., 'small drawer divider', 'clear stackable bin', 'label maker + file folder'). Be specific and practical.",
  "keep_or_discard": "keep" | "consider_discarding" | "donate",
  "keep_or_discard_reason": "One concise sentence explaining the keep/discard recommendation based on the item's nature and any relevant guide principles.",
  "reasoning": "One or two sentences explaining WHY this space is the best match, referencing guide principles if available."
}

Return ONLY the JSON object, no markdown, no explanation.
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) ||
                      text.match(/```\s*([\s\S]*?)\s*```/) ||
                      [null, text];

    const parsed = JSON.parse((jsonMatch[1] || text).trim());

    return {
      bestSpaceId: parsed.best_space_id || null,
      bestSpaceLabel: parsed.best_space_label || 'No matching space found',
      suggestedOrganizer: parsed.suggested_organizer || '',
      keepOrDiscard: parsed.keep_or_discard || 'keep',
      keepOrDiscardReason: parsed.keep_or_discard_reason || '',
      reasoning: parsed.reasoning || '',
    };
  } catch (error) {
    console.error('[aiService.getSmartSuggestion] Error:', error);
    return getPlaceholderSuggestion(aiResult, userSpaces);
  }
}

function getPlaceholderSuggestion(aiResult, userSpaces) {
  const bestSpace = userSpaces.length > 0 ? userSpaces[0] : null;
  return {
    bestSpaceId: bestSpace?.id || null,
    bestSpaceLabel: bestSpace
      ? bestSpace.macro_space + (bestSpace.micro_zone ? ` › ${bestSpace.micro_zone}` : '')
      : aiResult.recommendedIdealSpace || 'No spaces mapped yet',
    suggestedOrganizer: 'Small clear bin or drawer divider',
    keepOrDiscard: 'keep',
    keepOrDiscardReason: 'Item appears to be in regular use and worth keeping.',
    reasoning: 'Based on the item type, this is the most accessible storage location.',
    isPlaceholder: true,
  };
}

/**
 * Calculate importance score and recommendation from answers
 * @param {string} categoryKey - The category key
 * @param {Object} answers - Object mapping questionId to selected option value
 * @returns {Object} - Score, priority level, and action recommendation
 */
export function calculateImportanceScore(categoryKey, answers) {
  const template = IMPORTANCE_QUESTIONS[categoryKey] || IMPORTANCE_QUESTIONS.default;
  
  let totalScore = 0;
  const breakdown = [];
  
  // Calculate min and max possible scores from options
  let minPossible = 0;
  let maxPossible = 0;
  
  template.questions.forEach(q => {
    const scores = q.options.map(o => o.score);
    minPossible += Math.min(...scores);
    maxPossible += Math.max(...scores);
    
    const answer = answers[q.id];
    const option = q.options.find(o => o.value === answer);
    if (option) {
      totalScore += option.score;
      breakdown.push({
        question: q.question,
        answer: option.label,
        score: option.score,
      });
    }
  });
  
  // Normalize to 1-100 percentage
  const range = maxPossible - minPossible;
  const keepScore = range > 0
    ? Math.round(((totalScore - minPossible) / range) * 100)
    : 50;
  
  // Determine priority and action based on normalized score
  let priority, action, storageLocation;
  
  if (keepScore <= 20) {
    priority = 'toss';
    action = '🗑️ Consider Tossing';
    storageLocation = 'Donate, recycle, or dispose';
  } else if (keepScore <= 40) {
    priority = 'low';
    action = '📦 Store Out of Sight';
    storageLocation = 'Back of closet, attic, basement, or deep storage';
  } else if (keepScore <= 65) {
    priority = 'medium';
    action = '🗄️ Standard Storage';
    storageLocation = 'Closet, cabinet, or designated storage area';
  } else {
    priority = 'high';
    action = '⭐ Keep Accessible';
    storageLocation = 'Front of closet, easy-reach shelf, or daily use area';
  }
  
  return {
    keepScore,
    breakdown,
    priority,
    action,
    storageLocation,
    category: template.category,
  };
}
