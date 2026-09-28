import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import MaterialCommunityIcon from "@expo/vector-icons/MaterialCommunityIcons";
import React from "react";

import { TopBar } from "../components/top-bar/top-bar-feature";
import { HomeScreen } from "../screens/HomeScreen";
import { ReceiptReviewScreen } from "../screens/ReceiptReviewScreen";

const Tab = createBottomTabNavigator();

export function HomeNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        header: () => <TopBar />,
        tabBarIcon: ({ focused, color, size }) => {
          switch (route.name) {
            case "Home":
              return (
                <MaterialCommunityIcon
                  name={focused ? "home" : "home-outline"}
                  size={size}
                  color={color}
                />
              );

            case "Split":
              return (
                <MaterialCommunityIcon
                  name={focused ? "application-edit" : "application-edit-outline"}
                  size={size}
                  color={color}
                />
              );

            default:
              return null;
          }
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Split" component={ReceiptReviewScreen} />
    </Tab.Navigator>
  );
}
