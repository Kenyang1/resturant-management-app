/**
 * Root layout: loads Nunito fonts, applies React Native Paper theme, and defines the navigation stack
 * (auth screens + tabbed main app). Splash screen stays up until fonts load or fail.
 */
import { colors } from "@/lib/theme";
import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  useFonts,
} from "@expo-google-fonts/nunito";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { PaperProvider, MD3LightTheme, configureFonts } from "react-native-paper";

SplashScreen.preventAutoHideAsync();

// Flat config merges Nunito into MD3 typescale (weights still come from each variant).
const nunitoFonts = configureFonts({
  isV3: true,
  config: {
    fontFamily: "Nunito_400Regular",
  },
});

const appTheme = {
  ...MD3LightTheme,
  roundness: 16,
  fonts: nunitoFonts,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.primary,
    primaryContainer: "#EAF5ED",
    secondary: colors.secondary,
    secondaryContainer: "#EEF6F1",
    tertiary: colors.settings,
    tertiaryContainer: "#F1F4F0",
    surface: colors.surface,
    surfaceVariant: "#F3F4F1",
    background: colors.background,
    error: colors.error,
    onPrimary: "#FFFFFF",
    onSurface: colors.textPrimary,
    outline: colors.border,
  },
};

export default function RootLayout() {
  const [loaded, err] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
  });

  useEffect(() => {
    if (loaded || err) SplashScreen.hideAsync();
  }, [loaded, err]);

  if (!loaded && !err) return null;

  return (
    <PaperProvider theme={appTheme}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="sign-up" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="reset-password" />
        <Stack.Screen name="accept-invite" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </PaperProvider>
  );
}
