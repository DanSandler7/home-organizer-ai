import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, StyleSheet } from 'react-native';

// Screen imports (placeholders for now)
import SpacesScreen from '../screens/SpacesScreen';
import OrganizeScreen from '../screens/OrganizeScreen';
import FindItemScreen from '../screens/FindItemScreen';
import GuidesScreen from '../screens/GuidesScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Simple tab icon component
const TabIcon = ({ label, focused }) => (
  <Text style={[styles.tabIcon, focused && styles.tabIconFocused]}>
    {label}
  </Text>
);

export default function Navigation() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: true,
          tabBarActiveTintColor: '#4A90D9',
          tabBarInactiveTintColor: '#888',
        }}
      >
        <Tab.Screen
          name="Spaces"
          component={SpacesScreen}
          options={{
            tabBarLabel: 'My Spaces',
            tabBarIcon: ({ focused }) => (
              <TabIcon label="📦" focused={focused} />
            ),
            title: 'My Spaces',
          }}
        />
        <Tab.Screen
          name="Organize"
          component={OrganizeScreen}
          options={{
            tabBarLabel: 'Organize Item',
            tabBarIcon: ({ focused }) => (
              <TabIcon label="📸" focused={focused} />
            ),
            title: 'Organize Item',
          }}
        />
        <Tab.Screen
          name="Find"
          component={FindItemScreen}
          options={{
            tabBarLabel: 'Find Item',
            tabBarIcon: ({ focused }) => (
              <TabIcon label="🔍" focused={focused} />
            ),
            title: 'Find Item',
          }}
        />
        {/* Guides tab hidden - feature not ready */}
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabIcon: {
    fontSize: 24,
    opacity: 0.6,
  },
  tabIconFocused: {
    opacity: 1,
  },
});
