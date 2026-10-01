import { Alert } from 'react-native';
export function reportError(error: unknown) {
  console.error(error);
  Alert.alert('Could not finish this action', error instanceof Error ? error.message : 'Please try again. Your existing records are still available.');
}
