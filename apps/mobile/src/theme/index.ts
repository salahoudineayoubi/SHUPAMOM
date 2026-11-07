/** SHUPAMOM brand tokens — from the official brand sheet (assets/brand/shupamom_brand_sheet.png). */
export const colors = {
  purple: "#5B0A87", // violet principal — identité, confiance
  purpleDeep: "#2E0248", // violet profond — élégance, technologie
  purpleSoft: "#EFE3F7",
  gold: "#F4A300", // or bamoun — patrimoine, richesse
  goldSoft: "#FFF1D1",
  ivory: "#FFF9EF", // ivoire — équilibre, clarté
  white: "#FFFFFF",
  ink: "#1E1027",
  muted: "#6B5E74",
  line: "#E8DDEE",
  success: "#1E8E5A",
  successSoft: "#E3F5EC",
  danger: "#C0392B",
  dangerSoft: "#FBE6E3",
} as const;

export const fonts = {
  regular: "Poppins_400Regular",
  medium: "Poppins_500Medium",
  semibold: "Poppins_600SemiBold",
  bold: "Poppins_700Bold",
} as const;

export const radius = { sm: 10, md: 16, lg: 24, pill: 999 } as const;
export const space = (n: number) => n * 4;

export const shadow = {
  shadowColor: "#2E0248",
  shadowOpacity: 0.08,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 8 },
  elevation: 3,
} as const;
