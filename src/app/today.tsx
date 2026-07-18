// // app/today.tsx
// import BottomSheet from '@gorhom/bottom-sheet';
// import { FlashList } from "@shopify/flash-list";
// import { useMemo, useRef, useState } from 'react';
// import { Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
// import { GestureHandlerRootView } from 'react-native-gesture-handler';
// import { SafeAreaView } from 'react-native-safe-area-context';
// import NewTaskModal from '../components/new-task';
// import { Task, TaskCard } from '../components/TaskCard';


// const MOCK_TASKS: Task[] = [
//   { id: '1', title: 'Brush teeth', type: 'Simple', priority: 'high', isCompleted: true},
//   { id: '2', title: 'Eat breakfast', type: 'Simple', priority: 'high', isCompleted: true },
//   { id: '3', title: 'Complete 1.2 milestone', type: 'Hybrid', priority: 'medium', isCompleted: false, subtasks_completed: 3, subtasks_total: 5 },
//   { id: '4', title: 'Play Metro: Last Light', type: 'Simple', priority: 'low', isCompleted: false, procrastination_count: 5 },
//   { id: '5', title: 'Work out (Upper Body)', type: 'Simple', priority: 'high', isCompleted: true },
//   { id: '6', title: 'Work on Obsidian Vault', type: 'Simple', priority: 'low', isCompleted: true },
//   { id: '7', title: 'Read 20 pages of Sci-Fi book', type: 'Progression', priority: 'medium', isCompleted: true, current_progress: 20, total_progress: 20, progress_unit: 'pages' },
//   { id: '8', title: 'Draw character concepts', type: 'Simple', priority: 'low', isCompleted: false, procrastination_count: 2 },
//   { id: '9', title: 'Brush teeth before bed', type: 'Simple', priority: 'high', isCompleted: false },
//   { id: '10', title: 'Go to sleep before midnight', type: 'Simple', priority: 'high', isCompleted: false, procrastination_count: 1 },
//   { id: '11', title: 'Drink 500ml water', type: 'Simple', priority: 'medium', isCompleted: true },
//   { id: '12', title: 'Check morning emails', type: 'Simple', priority: 'low', isCompleted: true },
//   { id: '13', title: 'Review Github Pull Requests', type: 'Hybrid', priority: 'high', isCompleted: false, subtasks_completed: 1, subtasks_total: 4 },
//   { id: '14', title: 'Plan weekly meal prep', type: 'Hybrid', priority: 'medium', isCompleted: false, subtasks_completed: 0, subtasks_total: 3, procrastination_count: 3 },
//   { id: '15', title: 'Take vitamin supplements', type: 'Simple', priority: 'low', isCompleted: true },
//   { id: '16', title: 'Call parents', type: 'Simple', priority: 'medium', isCompleted: false },
//   { id: '17', title: 'Clean desktop monitor', type: 'Simple', priority: 'low', isCompleted: true },
//   { id: '18', title: 'Empty the trash bin', type: 'Simple', priority: 'low', isCompleted: true },
//   { id: '19', title: 'Water balcony plants', type: 'Simple', priority: 'low', isCompleted: false },
//   { id: '20', title: 'Stretch for 10 minutes', type: 'Progression', priority: 'medium', isCompleted: true, current_progress: 10, total_progress: 10, progress_unit: 'mins' },
//   { id: '21', title: 'Fix broken CSS layout on dashboard', type: 'Simple', priority: 'high', isCompleted: false, procrastination_count: 4 },
//   { id: '22', title: 'Update project dependencies', type: 'Hybrid', priority: 'medium', isCompleted: true, subtasks_completed: 6, subtasks_total: 6 },
//   { id: '23', title: 'Refactor auth state logic', type: 'Hybrid', priority: 'high', isCompleted: false, subtasks_completed: 2, subtasks_total: 8 },
//   { id: '24', title: 'Brainstorm app logo ideas', type: 'Simple', priority: 'low', isCompleted: false },
//   { id: '25', title: 'Organize download folder', type: 'Simple', priority: 'low', isCompleted: true },
//   { id: '26', title: 'Pay internet bill', type: 'Simple', priority: 'high', isCompleted: true },
//   { id: '27', title: 'Renew domain registration', type: 'Simple', priority: 'medium', isCompleted: false },
//   { id: '28', title: 'Write 500 words for blog post', type: 'Progression', priority: 'medium', isCompleted: false, current_progress: 150, total_progress: 500, progress_unit: 'words', procrastination_count: 2 },
//   { id: '29', title: 'Research Tailwind v4 changes', type: 'Simple', priority: 'low', isCompleted: true },
//   { id: '30', title: 'Back up database to AWS', type: 'Hybrid', priority: 'high', isCompleted: true, subtasks_completed: 3, subtasks_total: 3 },
//   { id: '31', title: 'Wash the dishes', type: 'Simple', priority: 'medium', isCompleted: true },
//   { id: '32', title: 'Do laundry (whites)', type: 'Simple', priority: 'low', isCompleted: false },
//   { id: '33', title: 'Vacuum the living room', type: 'Simple', priority: 'medium', isCompleted: true },
//   { id: '34', title: 'Wipe kitchen counters', type: 'Simple', priority: 'low', isCompleted: true },
//   { id: '35', title: 'Clean out refrigerator leftovers', type: 'Simple', priority: 'medium', isCompleted: false },
//   { id: '36', title: 'Iron shirts for the week', type: 'Simple', priority: 'low', isCompleted: false },
//   { id: '37', title: 'Mop bedroom floor', type: 'Simple', priority: 'low', isCompleted: false },
//   { id: '38', title: 'Disinfect phone and keyboard', type: 'Simple', priority: 'medium', isCompleted: true },
//   { id: '39', title: 'Replace bathroom lightbulb', type: 'Simple', priority: 'low', isCompleted: true },
//   { id: '40', title: 'Organize clothing closet', type: 'Hybrid', priority: 'low', isCompleted: false, subtasks_completed: 1, subtasks_total: 5 },
//   { id: '41', title: 'Complete LeetCode daily challenge', type: 'Progression', priority: 'high', isCompleted: false, current_progress: 0, total_progress: 1, progress_unit: 'problem', procrastination_count: 1 },
//   { id: '42', title: 'Watch React Native Europe talk', type: 'Simple', priority: 'low', isCompleted: true },
//   { id: '43', title: 'Read documentation on FlashList recycling', type: 'Simple', priority: 'medium', isCompleted: true },
//   { id: '44', title: 'Practice touch typing for 15 mins', type: 'Progression', priority: 'low', isCompleted: true, current_progress: 15, total_progress: 15, progress_unit: 'mins' },
//   { id: '45', title: 'Review TypeScript advanced types', type: 'Simple', priority: 'medium', isCompleted: false },
//   { id: '46', title: 'Listen to tech podcast episode', type: 'Simple', priority: 'low', isCompleted: true },
//   { id: '47', title: 'Configure Neovim shortcuts', type: 'Hybrid', priority: 'low', isCompleted: false, subtasks_completed: 4, subtasks_total: 12 },
//   { id: '48', title: 'Set up SSH keys on new laptop', type: 'Simple', priority: 'high', isCompleted: true },
//   { id: '49', title: 'Test API endpoints in Postman', type: 'Hybrid', priority: 'medium', isCompleted: false, subtasks_completed: 7, subtasks_total: 10 },
//   { id: '50', title: 'Draft system architecture diagram', type: 'Hybrid', priority: 'high', isCompleted: false, subtasks_completed: 0, subtasks_total: 4 },
//   { id: '51', title: 'Buy cat food', type: 'Simple', priority: 'high', isCompleted: true },
//   { id: '52', title: 'Pick up package from locker', type: 'Simple', priority: 'medium', isCompleted: false },
//   { id: '53', title: 'Order replacement running shoes', type: 'Simple', priority: 'low', isCompleted: false },
//   { id: '54', title: 'Buy fresh coffee beans', type: 'Simple', priority: 'medium', isCompleted: true },
//   { id: '55', title: 'Gift shopping for friend birthday', type: 'Hybrid', priority: 'high', isCompleted: true, subtasks_completed: 2, subtasks_total: 2 },
//   { id: '56', title: 'Return Amazon items', type: 'Simple', priority: 'low', isCompleted: false },
//   { id: '57', title: 'Restock bathroom tissues', type: 'Simple', priority: 'medium', isCompleted: true },
//   { id: '58', title: 'Purchase digital drawing brush pack', type: 'Simple', priority: 'low', isCompleted: true },
//   { id: '59', title: 'Buy desk cable organizer ties', type: 'Simple', priority: 'low', isCompleted: false },
//   { id: '60', title: 'Renew gym membership', type: 'Simple', priority: 'high', isCompleted: true },
//   { id: '61', title: 'Review monthly bank statements', type: 'Hybrid', priority: 'high', isCompleted: true, subtasks_completed: 3, subtasks_total: 3 },
//   { id: '62', title: 'Update personal budget spreadsheet', type: 'Hybrid', priority: 'medium', isCompleted: false, subtasks_completed: 1, subtasks_total: 4 },
//   { id: '63', title: 'Cancel unused streaming trial', type: 'Simple', priority: 'high', isCompleted: true },
//   { id: '64', title: 'File quarterly tax documents', type: 'Hybrid', priority: 'high', isCompleted: false, subtasks_completed: 0, subtasks_total: 6, procrastination_count: 7 },
//   { id: '65', title: 'Check credit score report', type: 'Simple', priority: 'low', isCompleted: true },
//   { id: '66', title: 'Transfer money to savings account', type: 'Simple', priority: 'high', isCompleted: true },
//   { id: '67', title: 'Research index funds performance', type: 'Progression', priority: 'medium', isCompleted: false, current_progress: 2, total_progress: 5, progress_unit: 'articles' },
//   { id: '68', title: 'Analyze utility bill spike', type: 'Simple', priority: 'low', isCompleted: false },
//   { id: '69', title: 'Sort through paper mail receipts', type: 'Simple', priority: 'low', isCompleted: true },
//   { id: '70', title: 'Set up automatic rent payment', type: 'Simple', priority: 'high', isCompleted: true },
//   { id: '71', title: 'Run 5 kilometers trail', type: 'Progression', priority: 'high', isCompleted: true, current_progress: 5, total_progress: 5, progress_unit: 'km' },
//   { id: '72', title: 'Prepare gym bag for tomorrow', type: 'Simple', priority: 'low', isCompleted: false },
//   { id: '73', title: 'Track daily calorie intake', type: 'Progression', priority: 'medium', isCompleted: true, current_progress: 2200, total_progress: 2500, progress_unit: 'kcal' },
//   { id: '74', title: 'Clean running sneakers', type: 'Simple', priority: 'low', isCompleted: false },
//   { id: '75', title: 'Schedule annual physical exam', type: 'Simple', priority: 'medium', isCompleted: false },
//   { id: '76', title: 'Floss before bed', type: 'Simple', priority: 'high', isCompleted: false },
//   { id: '77', title: 'Meditate for 5 minutes', type: 'Simple', priority: 'low', isCompleted: true },
//   { id: '78', title: 'Wash gym water bottle', type: 'Simple', priority: 'low', isCompleted: true },
//   { id: '79', title: 'Buy protein powder supplement', type: 'Simple', priority: 'medium', isCompleted: false },
//   { id: '80', title: 'Check skin mole changes at doctor', type: 'Simple', priority: 'high', isCompleted: false, procrastination_count: 14 },
//   { id: '81', title: 'Clean side mirrors on car', type: 'Simple', priority: 'low', isCompleted: true },
//   { id: '82', title: 'Refill windshield wiper fluid', type: 'Simple', priority: 'medium', isCompleted: false },
//   { id: '83', title: 'Vacuum car passenger seats', type: 'Simple', priority: 'low', isCompleted: false },
//   { id: '84', title: 'Check tire pressure levels', type: 'Simple', priority: 'high', isCompleted: true },
//   { id: '85', title: 'Book vehicle oil change service', type: 'Simple', priority: 'high', isCompleted: false, procrastination_count: 3 },
//   { id: '86', title: 'Clean dust from car dashboard', type: 'Simple', priority: 'low', isCompleted: true },
//   { id: '87', title: 'Organize glove compartment box', type: 'Simple', priority: 'low', isCompleted: false },
//   { id: '88', title: 'Update car insurance policy details', type: 'Hybrid', priority: 'medium', isCompleted: false, subtasks_completed: 1, subtasks_total: 3 },
//   { id: '89', title: 'Wash car exterior thoroughly', type: 'Simple', priority: 'medium', isCompleted: true },
//   { id: '90', title: 'Replace cabin air filter unit', type: 'Simple', priority: 'medium', isCompleted: false },
//   { id: '91', title: 'Play 2 matches of competitive game', type: 'Simple', priority: 'low', isCompleted: false },
//   { id: '92', title: 'Clean mechanical keyboard switches', type: 'Hybrid', priority: 'low', isCompleted: true, subtasks_completed: 61, subtasks_total: 61 },
//   { id: '93', title: 'Update Discord desktop client app', type: 'Simple', priority: 'low', isCompleted: true },
//   { id: '94', title: 'Organize digital gaming library grid', type: 'Simple', priority: 'low', isCompleted: false },
//   { id: '95', title: 'Watch new movie trailer release', type: 'Simple', priority: 'low', isCompleted: true },
//   { id: '96', title: 'Clean audio mixing desk monitors', type: 'Simple', priority: 'medium', isCompleted: false },
//   { id: '97', title: 'Sort digital screenshot files folder', type: 'Simple', priority: 'low', isCompleted: true },
//   { id: '98', title: 'Check game mod updates on nexus', type: 'Simple', priority: 'low', isCompleted: false },
//   { id: '99', title: 'Charge wireless mouse battery pack', type: 'Simple', priority: 'medium', isCompleted: true },
//   { id: '100', title: 'Calibrate gaming monitor colors', type: 'Simple', priority: 'low', isCompleted: false }
// ];

// export function DateHeader() {
//   const currentDate = new Date().toLocaleDateString('ur-US', {
//     weekday: 'long',
//     year: 'numeric',
//     month: 'long',
//     day: 'numeric',
//   });

//   return (
//     <View>
//       <Text style={styles.dateHeaderText}>{currentDate}</Text>
//     </View>
//   );
// }

// export default function AppDashboard() {
//   const taskSheetRef = useRef<BottomSheet>(null);

//   const [tasks, setTasks] = useState<Task[]>(MOCK_TASKS);

// const handleToggleTask = (id: string) => {
//   setTasks((prevTasks) => {
//     return prevTasks.map((task) => {
//       if (task.id === id) {
//         return { ...task, isCompleted: !task.isCompleted };
//       } else {
//         return task;
//       }
//     });
//   });
// };
//   // const sortedTasks = [...tasks].sort((a, b) => Number(a.isCompleted) - Number(b.isCompleted));



//   {/*This is the calculation for metric */}
//   const summary = useMemo(() => {
//     return tasks.reduce((acc, task) => {
//   acc.total++;
//   acc.types[task.type] = (acc.types[task.type] || 0) +1;
//   acc.priorities[task.priority] = (acc.priorities[task.priority] || 0) + 1;
//   if (task.isCompleted) acc.completed++; else acc.incomplete++;
//   return acc;
// }, {
//   total: 0, types: {} as Record<string,number>, priorities: {} as Record<string, number>, completed: 0, incomplete: 0
// });
// }, [tasks]);

//   return (
//     <GestureHandlerRootView style={{ flex: 1 }}>
//     <SafeAreaView style={styles.container}>
//       <StatusBar barStyle="dark-content" backgroundColor={styles.container.backgroundColor} />
//       {/* This is the header */}
//       <View style={styles.stickyHeader}>
//         <DateHeader/>

//         {/*This is the metric */}
//         <View style={{ paddingHorizontal: 20, marginHorizontal: 25, marginVertical:20, backgroundColor: "#ededed", borderRadius: 12, paddingVertical: 10, elevation: 10 }}>
//           <Text style={{ fontWeight:"500", textAlign:"center"}}>Task Metrics</Text>
//           <Text>Total Tasks: {summary.total} | Completed:<Text style={{ color:"#40af69"}}> {summary.completed}</Text> | Pending: {summary.incomplete}</Text>
//           <Text>Simple: {summary.types['Simple']} | Hybrid: {summary.types['Hybrid']} | Progression: {summary.types['Progression']}</Text>
//           <Text><Text style={{ color:"#c40000"}}>High Priority: {summary.priorities['high']} </Text>| Medium Priority: {summary.priorities['medium']} | Low Priority: {summary.priorities['low']}</Text>
//         </View>
//       </View>

//       {/*This is the list */}
//       <View style={{flex: 1}}>
//       <FlashList
//         data={tasks} // to make it sorted, do data={sortedTasks}
//         keyExtractor={(item) => item.id}
//         contentContainerStyle={styles.listContent}
//         renderItem={({ item }) => <TaskCard task={item} onToggle={handleToggleTask} />}
//       />
//       </View>

//       {/*This is the button */}
//       <Pressable onPress={() => taskSheetRef.current?.expand()} style={({ pressed }) => [
//         styles.buttonStuff, { backgroundColor: pressed ? "#155b76" : "#1c8db9" }
//       ]}>
//         <Text style={styles.buttonText}>+</Text>
//       </Pressable>
//       <NewTaskModal sheetRef={taskSheetRef} />
//     </SafeAreaView> 
//     </GestureHandlerRootView>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: '#fafafa',
//   },
//   dateHeaderText: {
//   fontSize: 22,
//   color: '#1A1A1A',
//   fontWeight: '800',
//   paddingLeft: 10,
//   paddingTop: 20
//   },
//   stickyHeader:{
//     backgroundColor: '#FFFFFF',
//     borderBottomWidth: 1,
//     borderColor: '#EAEAEA',
//     elevation: 2,
//   },
  
//   listContent: {
//     paddingHorizontal: 20,
//     paddingTop: 4
//   },
//   buttonStuff:{
//     width: 75,
//     height: 75,
//     position:"absolute",
//     bottom:65,
//     right:15,
//     justifyContent: "center",
//     alignItems: "center", 
//     borderRadius: 37.5

//   },
//   buttonText:{
//     color: "#ffffff",
//     fontSize: 25,
//   }
// });

import { useEffect } from 'react';
import { db } from '../db/client'; // Your path to client
import { events, goals, habitLogs, habits, notes, progressLogs, tags, tasks, taskTags } from '../db/schema'; // Your path to schema

export default function HomeScreen() {
  useEffect(() => {
    async function verifyTables() {
      try {
        // Run a dummy select query on each table using Drizzle's official syntax.
        // If the tables don't exist, these lines will throw an error immediately!
        await db.select().from(tasks).limit(1);
        await db.select().from(progressLogs).limit(1);
        await db.select().from(goals).limit(1);
        await db.select().from(habits).limit(1);
        await db.select().from(habitLogs).limit(1);
        await db.select().from(events).limit(1);
        await db.select().from(notes).limit(1);
        await db.select().from(tags).limit(1);
        await db.select().from(taskTags).limit(1);
        
        console.log("=========================================");
        console.log("SUCCESS! All tables exist and verified on device!");
        console.log("=========================================");
      } catch (err: any) {
        console.error("❌ Database table verification failed:", err.message);
      }
    }

    verifyTables();
  }, []);

  return null; // Or your home screen UI
}