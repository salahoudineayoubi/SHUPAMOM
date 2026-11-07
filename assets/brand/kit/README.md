# SHUPAMOM — Kit logo et assets

Éléments produits à partir du logo approuvé. Les fichiers PNG utilisent l’illustration sélectionnée et sa palette de couleurs.

## Installation Expo
1. Copier `assets/images` dans la racine de l’application.
2. Reporter les clés `icon`, `android.adaptiveIcon`, `web.favicon` et le plugin `expo-splash-screen` depuis `expo-config.example.json` dans votre propre `app.json` (sans écraser la configuration existante).
3. Installer le plugin si nécessaire : `npx expo install expo-splash-screen`.
4. Reconstruire une version native pour vérifier les icônes sur téléphone. Les variantes adaptatives Android peuvent être masquées différemment selon le fabricant.

**Fichiers importants**
- `icon.png` : icône iOS/Android, opaque, 1024×1024
- `adaptive-icon.png` : premier plan Android, transparent avec zone de sécurité
- `adaptive-background.png` : fond Android
- `adaptive-monochrome.png` : icône monochrome pour thèmes Android
- `favicon.ico` / `favicon-32.png` : favicon web
- `splash-logo.png` : logo transparent à centrer sur fond `#FFF9EF`
- `logo-horizontal.png` : identité horizontale transparente
- `logo-primary-transparent.png` : logo d'origine
- `splash-preview-1284x2778.png` : visuel de présentation, à ne pas utiliser dans le plugin Expo

## Palette
- Violet principal : `#4A035B`
- Or : `#F5A60D`
- Ivoire : `#FFF9EF`

## Notes
- Le favicon est volontairement simplifié pour rester lisible à 16×16 et 32×32.
- Les éléments culturels de l’illustration proviennent du logo approuvé, sans prétendre reproduire un symbole historique officiel.
- Vérifier les graphismes à taille réelle sur iOS, Android et navigateur.
