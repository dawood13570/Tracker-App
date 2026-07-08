// app/index.tsx
import { FlashList } from "@shopify/flash-list";
import { StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Task {
  id: string;
  title: string;
  type: 'simple' | 'progression' | 'hybrid';
  priority: 'low' | 'medium' | 'high';
  isCompleted: boolean;
}

const MOCK_TASKS: Task[] = [
  { id: '1', title: 'Brush teeth', type: 'simple', priority: 'high', isCompleted: true },
  { id: '2', title: 'Eat breakfast', type: 'simple', priority: 'high', isCompleted: true },
  { id: '3', title: 'Complete 1.2 milestone', type: 'hybrid', priority: 'medium', isCompleted: false },
  { id: '4', title: 'Play Metro: Last Light', type: 'simple', priority: 'low', isCompleted: false },
  { id: '5', title: 'Work out (Upper Body)', type: 'simple', priority: 'high', isCompleted: true },
  { id: '6', title: 'Work on Obsidian Vault', type: 'simple', priority: 'low', isCompleted: true },
  { id: '7', title: 'Read 20 pages of Sci-Fi book', type: 'progression', priority: 'medium', isCompleted: true },
  { id: '8', title: 'Draw character concepts', type: 'simple', priority: 'low', isCompleted: false },
  { id: '9', title: 'Brush teeth before bed', type: 'simple', priority: 'high', isCompleted: false },
  { id: '10', title: 'Go to sleep before midnight', type: 'simple', priority: 'high', isCompleted: false },
  { id: '11', title: 'Drink 500ml water', type: 'simple', priority: 'medium', isCompleted: true },
  { id: '12', title: 'Check morning emails', type: 'simple', priority: 'low', isCompleted: true },
  { id: '13', title: 'Review Github Pull Requests', type: 'hybrid', priority: 'high', isCompleted: false },
  { id: '14', title: 'Plan weekly meal prep', type: 'hybrid', priority: 'medium', isCompleted: false },
  { id: '15', title: 'Take vitamin supplements', type: 'simple', priority: 'low', isCompleted: true },
  { id: '16', title: 'Call parents', type: 'simple', priority: 'medium', isCompleted: false },
  { id: '17', title: 'Clean desktop monitor', type: 'simple', priority: 'low', isCompleted: true },
  { id: '18', title: 'Empty the trash bin', type: 'simple', priority: 'low', isCompleted: true },
  { id: '19', title: 'Water balcony plants', type: 'simple', priority: 'low', isCompleted: false },
  { id: '20', title: 'Stretch for 10 minutes', type: 'progression', priority: 'medium', isCompleted: true },
  { id: '21', title: 'Fix broken CSS layout on dashboard', type: 'simple', priority: 'high', isCompleted: false },
  { id: '22', title: 'Update project dependencies', type: 'hybrid', priority: 'medium', isCompleted: true },
  { id: '23', title: 'Refactor auth state logic', type: 'hybrid', priority: 'high', isCompleted: false },
  { id: '24', title: 'Brainstorm app logo ideas', type: 'simple', priority: 'low', isCompleted: false },
  { id: '25', title: 'Organize download folder', type: 'simple', priority: 'low', isCompleted: true },
  { id: '26', title: 'Pay internet bill', type: 'simple', priority: 'high', isCompleted: true },
  { id: '27', title: 'Renew domain registration', type: 'simple', priority: 'medium', isCompleted: false },
  { id: '28', title: 'Write 500 words for blog post', type: 'progression', priority: 'medium', isCompleted: false },
  { id: '29', title: 'Research Tailwind v4 changes', type: 'simple', priority: 'low', isCompleted: true },
  { id: '30', title: 'Back up database to AWS', type: 'hybrid', priority: 'high', isCompleted: true },
  { id: '31', title: 'Wash the dishes', type: 'simple', priority: 'medium', isCompleted: true },
  { id: '32', title: 'Do laundry (whites)', type: 'simple', priority: 'low', isCompleted: false },
  { id: '33', title: 'Vacuum the living room', type: 'simple', priority: 'medium', isCompleted: true },
  { id: '34', title: 'Wipe kitchen counters', type: 'simple', priority: 'low', isCompleted: true },
  { id: '35', title: 'Clean out refrigerator leftovers', type: 'simple', priority: 'medium', isCompleted: false },
  { id: '36', title: 'Iron shirts for the week', type: 'simple', priority: 'low', isCompleted: false },
  { id: '37', title: 'Mop bedroom floor', type: 'simple', priority: 'low', isCompleted: false },
  { id: '38', title: 'Disinfect phone and keyboard', type: 'simple', priority: 'medium', isCompleted: true },
  { id: '39', title: 'Replace bathroom lightbulb', type: 'simple', priority: 'low', isCompleted: true },
  { id: '40', title: 'Organize clothing closet', type: 'hybrid', priority: 'low', isCompleted: false },
  { id: '41', title: 'Complete LeetCode daily challenge', type: 'progression', priority: 'high', isCompleted: false },
  { id: '42', title: 'Watch React Native Europe talk', type: 'simple', priority: 'low', isCompleted: true },
  { id: '43', title: 'Read documentation on FlashList recycling', type: 'simple', priority: 'medium', isCompleted: true },
  { id: '44', title: 'Practice touch typing for 15 mins', type: 'progression', priority: 'low', isCompleted: true },
  { id: '45', title: 'Review TypeScript advanced types', type: 'simple', priority: 'medium', isCompleted: false },
  { id: '46', title: 'Listen to tech podcast episode', type: 'simple', priority: 'low', isCompleted: true },
  { id: '47', title: 'Configure Neovim shortcuts', type: 'hybrid', priority: 'low', isCompleted: false },
  { id: '48', title: 'Set up SSH keys on new laptop', type: 'simple', priority: 'high', isCompleted: true },
  { id: '49', title: 'Test API endpoints in Postman', type: 'hybrid', priority: 'medium', isCompleted: false },
  { id: '50', title: 'Draft system architecture diagram', type: 'hybrid', priority: 'high', isCompleted: false },
  { id: '51', title: 'Buy cat food', type: 'simple', priority: 'high', isCompleted: true },
  { id: '52', title: 'Pick up package from locker', type: 'simple', priority: 'medium', isCompleted: false },
  { id: '53', title: 'Order replacement running shoes', type: 'simple', priority: 'low', isCompleted: false },
  { id: '54', title: 'Buy fresh coffee beans', type: 'simple', priority: 'medium', isCompleted: true },
  { id: '55', title: 'Gift shopping for friend birthday', type: 'hybrid', priority: 'high', isCompleted: true },
  { id: '56', title: 'Return Amazon items', type: 'simple', priority: 'low', isCompleted: false },
  { id: '57', title: 'Restock bathroom tissues', type: 'simple', priority: 'medium', isCompleted: true },
  { id: '58', title: 'Purchase digital drawing brush pack', type: 'simple', priority: 'low', isCompleted: true },
  { id: '59', title: 'Buy desk cable organizer ties', type: 'simple', priority: 'low', isCompleted: false },
  { id: '60', title: 'Renew gym membership', type: 'simple', priority: 'high', isCompleted: true },
  { id: '61', title: 'Review monthly bank statements', type: 'hybrid', priority: 'high', isCompleted: true },
  { id: '62', title: 'Update personal budget spreadsheet', type: 'hybrid', priority: 'medium', isCompleted: false },
  { id: '63', title: 'Cancel unused streaming trial', type: 'simple', priority: 'high', isCompleted: true },
  { id: '64', title: 'File quarterly tax documents', type: 'hybrid', priority: 'high', isCompleted: false },
  { id: '65', title: 'Check credit score report', type: 'simple', priority: 'low', isCompleted: true },
  { id: '66', title: 'Transfer money to savings account', type: 'simple', priority: 'high', isCompleted: true },
  { id: '67', title: 'Research index funds performance', type: 'progression', priority: 'medium', isCompleted: false },
  { id: '68', title: 'Analyze utility bill spike', type: 'simple', priority: 'low', isCompleted: false },
  { id: '69', title: 'Sort through paper mail receipts', type: 'simple', priority: 'low', isCompleted: true },
  { id: '70', title: 'Set up automatic rent payment', type: 'simple', priority: 'high', isCompleted: true },
  { id: '71', title: 'Run 5 kilometers trail', type: 'progression', priority: 'high', isCompleted: true },
  { id: '72', title: 'Prepare gym bag for tomorrow', type: 'simple', priority: 'low', isCompleted: false },
  { id: '73', title: 'Track daily calorie intake', type: 'progression', priority: 'medium', isCompleted: true },
  { id: '74', title: 'Clean running sneakers', type: 'simple', priority: 'low', isCompleted: false },
  { id: '75', title: 'Schedule annual physical exam', type: 'simple', priority: 'medium', isCompleted: false },
  { id: '76', title: 'Floss before bed', type: 'simple', priority: 'high', isCompleted: false },
  { id: '77', title: 'Meditate for 5 minutes', type: 'simple', priority: 'low', isCompleted: true },
  { id: '78', title: 'Wash gym water bottle', type: 'simple', priority: 'low', isCompleted: true },
  { id: '79', title: 'Buy protein powder supplement', type: 'simple', priority: 'medium', isCompleted: false },
  { id: '80', title: 'Check skin mole changes at doctor', type: 'simple', priority: 'high', isCompleted: false },
  { id: '81', title: 'Clean side mirrors on car', type: 'simple', priority: 'low', isCompleted: true },
  { id: '82', title: 'Refill windshield wiper fluid', type: 'simple', priority: 'medium', isCompleted: false },
  { id: '83', title: 'Vacuum car passenger seats', type: 'simple', priority: 'low', isCompleted: false },
  { id: '84', title: 'Check tire pressure levels', type: 'simple', priority: 'high', isCompleted: true },
  { id: '85', title: 'Book vehicle oil change service', type: 'simple', priority: 'high', isCompleted: false },
  { id: '86', title: 'Clean dust from car dashboard', type: 'simple', priority: 'low', isCompleted: true },
  { id: '87', title: 'Organize glove compartment box', type: 'simple', priority: 'low', isCompleted: false },
  { id: '88', title: 'Update car insurance policy details', type: 'hybrid', priority: 'medium', isCompleted: false },
  { id: '89', title: 'Wash car exterior thoroughly', type: 'simple', priority: 'medium', isCompleted: true },
  { id: '90', title: 'Replace cabin air filter unit', type: 'simple', priority: 'medium', isCompleted: false },
  { id: '91', title: 'Play 2 matches of competitive game', type: 'simple', priority: 'low', isCompleted: false },
  { id: '92', title: 'Clean mechanical keyboard switches', type: 'hybrid', priority: 'low', isCompleted: true },
  { id: '93', title: 'Update Discord desktop client app', type: 'simple', priority: 'low', isCompleted: true },
  { id: '94', title: 'Organize digital gaming library grid', type: 'simple', priority: 'low', isCompleted: false },
  { id: '95', title: 'Watch new movie trailer release', type: 'simple', priority: 'low', isCompleted: true },
  { id: '96', title: 'Clean audio mixing desk monitors', type: 'simple', priority: 'medium', isCompleted: false },
  { id: '97', title: 'Sort digital screenshot files folder', type: 'simple', priority: 'low', isCompleted: true },
  { id: '98', title: 'Check game mod updates on nexus', type: 'simple', priority: 'low', isCompleted: false },
  { id: '99', title: 'Charge wireless mouse battery pack', type: 'simple', priority: 'medium', isCompleted: true },
  { id: '100', title: 'Calibrate gaming monitor colors', type: 'simple', priority: 'low', isCompleted: false }
];

export default function AppDashboard() {

  return (
    <SafeAreaView style={styles.container}>

      <StatusBar barStyle="dark-content" backgroundColor={styles.container.backgroundColor} />
      
      <View style={styles.headerContainer}>
        <Text style={styles.headerText}>This is the Header, and the list must go on and on and on and on</Text>
      </View>

      <FlashList
      data={MOCK_TASKS}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      renderItem={({ item}) => (
        <View style={styles.taskCard}>
          <Text style={styles.taskTitle}>{item.title}</Text>
          <Text style={styles.taskMeta}>
            {item.type.toUpperCase()} . {item.priority.toUpperCase()}
            </Text>
           </View>
      )}
      />

      {/* <ScrollView contentContainerStyle={styles.scrollContent}>
        
  
        <Text style={styles.headerTitle}>System Architecture</Text>
        <Text style={styles.dateSubtitle}>Active Environment Monitor</Text>


      </ScrollView> */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  headerContainer: {
    paddingHorizontal: 20,
  },
  headerText: {
    fontSize: 16,
    color: '#ff000081',
    fontWeight: '900',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 4
  },
  taskCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,

    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  taskMeta: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
  },
});