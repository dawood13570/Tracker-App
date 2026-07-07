import { Text, View } from 'react-native';

// 1. Define your component
function MonthScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Goals Screen</Text>
    </View>
  );
}

// 2. CRITICAL: This is what Expo Router is looking for!
export default MonthScreen;