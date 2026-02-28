import { useState, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ref, onValue, push, set, remove, update, get } from 'firebase/database';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  User
} from 'firebase/auth';
import { db, auth } from './firebase';
import { 
  Search,
  CreditCard as CreditCardIcon,
  Plus, 
  Trash2, 
  TrendingDown, 
  PieChart as PieChartIcon, 
  List, 
  Sparkles,
  IndianRupee,
  ChevronRight,
  Calendar,
  Tag,
  Scale,
  LogOut,
  Edit2,
  User as UserIcon,
  Mail,
  Lock,
  Users,
  Copy,
  Check,
  ArrowLeft,
  Settings,
  Home,
  BarChart3,
  Download,
  Building2,
  ArrowUpRight,
  ArrowDownLeft
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis
} from 'recharts';
import { 
  format, 
  parseISO, 
  startOfMonth, 
  endOfMonth, 
  isWithinInterval,
  subMonths,
  addMonths,
  setDate,
  isAfter,
  isBefore,
  startOfDay
} from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { Expense, CATEGORIES, UNITS, UserProfile, Family, CreditCard, PAYMENT_MODES, PaymentMode, Bank, BankTransaction } from './types';
import { getSavingsSuggestions } from './services/geminiService';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<string | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'stats' | 'family' | 'profile' | 'cards' | 'banks'>('list');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [memberProfiles, setMemberProfiles] = useState<Record<string, {name: string, photoURL?: string}>>({});

  // Search State
  const [searchQuery, setSearchQuery] = useState('');

  // Credit Card State
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [showCardModal, setShowCardModal] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [newCardName, setNewCardName] = useState('');
  const [newCardLimit, setNewCardLimit] = useState('');
  const [newCardBillDate, setNewCardBillDate] = useState('1');
  const [newCardDueDate, setNewCardDueDate] = useState('1');
  const [newCardDueAmount, setNewCardDueAmount] = useState('');

  // Bank State
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
  const [showBankModal, setShowBankModal] = useState(false);
  const [showBankTransactionModal, setShowBankTransactionModal] = useState(false);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const [newBankName, setNewBankName] = useState('');
  const [newBankInitialBalance, setNewBankInitialBalance] = useState('');
  
  // Bank Transaction State
  const [selectedBankIdForTx, setSelectedBankIdForTx] = useState('');
  const [newTxAmount, setNewTxAmount] = useState('');
  const [newTxDescription, setNewTxDescription] = useState('');
  const [newTxDate, setNewTxDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Profile Edit State
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editPhotoURL, setEditPhotoURL] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  const handleUpdateProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsUpdatingProfile(true);
    try {
      const userRef = ref(db, `users/${user.uid}`);
      await update(userRef, {
        displayName: editDisplayName,
        photoURL: editPhotoURL
      });
      setActiveTab('list');
    } catch (error) {
      console.error(error);
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // Report/Filter State
  const [reportStartDate, setReportStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [reportEndDate, setReportEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [isCustomRange, setIsCustomRange] = useState(false);

  // Family Form State
  const [familyName, setFamilyName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  // Form state
  const [newItem, setNewItem] = useState('');
  const [newCategory, setNewCategory] = useState(CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newQuantity, setNewQuantity] = useState('');
  const [newUnit, setNewUnit] = useState(UNITS[0]);
  const [newPaymentMode, setNewPaymentMode] = useState<PaymentMode>(PAYMENT_MODES[0]);
  const [selectedCardId, setSelectedCardId] = useState('');
  const [selectedBankId, setSelectedBankId] = useState('');
  const [newDate, setNewDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (!user) {
        setProfile(null);
        setFamily(null);
        setAuthLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const profileRef = ref(db, `users/${user.uid}`);
    const unsubscribe = onValue(profileRef, (snapshot) => {
      const data = snapshot.val();
      setProfile(data);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!profile?.familyId) {
      setFamily(null);
      return;
    }

    const familyRef = ref(db, `families/${profile.familyId}`);
    const unsubscribe = onValue(familyRef, (snapshot) => {
      setFamily(snapshot.val());
    });
    return () => unsubscribe();
  }, [profile]);

  useEffect(() => {
    if (!family?.members) return;

    const memberUids = Object.keys(family.members);
    const profiles: Record<string, string> = {};
    
    const unsubscribes = memberUids.map(uid => {
      const userRef = ref(db, `users/${uid}`);
      return onValue(userRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setMemberProfiles(prev => ({
            ...prev,
            [uid]: {
              name: data.displayName || data.email?.split('@')[0] || 'User',
              photoURL: data.photoURL
            }
          }));
        }
      });
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, [family]);

  useEffect(() => {
    if (!profile?.familyId) {
      setExpenses([]);
      setLoading(false);
      return;
    }

    const expensesRef = ref(db, `families/${profile.familyId}/expenses`);
    const unsubscribe = onValue(expensesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const expenseList: Expense[] = Object.keys(data).map((key) => ({
          ...data[key],
          id: key,
        }));
        expenseList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setExpenses(expenseList);
      } else {
        setExpenses([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile]);

  useEffect(() => {
    if (!profile?.familyId) {
      setCreditCards([]);
      return;
    }

    const cardsRef = ref(db, `families/${profile.familyId}/creditCards`);
    const unsubscribe = onValue(cardsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const cardList: CreditCard[] = Object.keys(data).map((key) => ({
          ...data[key],
          id: key,
        }));
        setCreditCards(cardList);
      } else {
        setCreditCards([]);
      }
    });

    return () => unsubscribe();
  }, [profile]);

  useEffect(() => {
    if (!profile?.familyId) {
      setBanks([]);
      setBankTransactions([]);
      return;
    }

    const banksRef = ref(db, `families/${profile.familyId}/banks`);
    const unsubBanks = onValue(banksRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setBanks(Object.keys(data).map(key => ({ ...data[key], id: key })));
      } else {
        setBanks([]);
      }
    });

    const txRef = ref(db, `families/${profile.familyId}/bankTransactions`);
    const unsubTx = onValue(txRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setBankTransactions(Object.keys(data).map(key => ({ ...data[key], id: key })));
      } else {
        setBankTransactions([]);
      }
    });

    return () => {
      unsubBanks();
      unsubTx();
    };
  }, [profile]);

  useEffect(() => {
    if (activeTab === 'profile' && profile) {
      setEditDisplayName(profile.displayName || '');
      setEditPhotoURL(profile.photoURL || '');
    }
  }, [activeTab, profile]);

  const handleAuth = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const newUser = userCredential.user;
        // Create initial profile
        await set(ref(db, `users/${newUser.uid}`), {
          uid: newUser.uid,
          email: email,
          displayName: displayName || email?.split('@')[0] || 'User',
          familyId: null,
          role: 'member'
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      setAuthError(error.message);
    }
  };

  const handleCreateFamily = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !familyName) return;

    const familyId = push(ref(db, 'families')).key!;
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const familyData: Family = {
      id: familyId,
      name: familyName,
      adminUid: user.uid,
      inviteCode: inviteCode,
      members: { [user.uid]: true }
    };

    try {
      await set(ref(db, `families/${familyId}`), familyData);
      await update(ref(db, `users/${user.uid}`), {
        familyId: familyId,
        role: 'admin'
      });
    } catch (error) {
      console.error("Error creating family:", error);
    }
  };

  const handleJoinFamily = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !inviteCode) return;

    setIsJoining(true);
    setAuthError(null);
    try {
      const familiesRef = ref(db, 'families');
      const snapshot = await get(familiesRef);
      const families = snapshot.val();
      
      let foundFamilyId = null;
      if (families) {
        for (const id in families) {
          if (families[id].inviteCode === inviteCode.toUpperCase().trim()) {
            foundFamilyId = id;
            break;
          }
        }
      }

      if (foundFamilyId) {
        await update(ref(db, `families/${foundFamilyId}/members`), {
          [user.uid]: true
        });
        await update(ref(db, `users/${user.uid}`), {
          familyId: foundFamilyId,
          role: 'member'
        });
      } else {
        setAuthError("Invalid invite code");
      }
    } catch (error) {
      console.error("Error joining family:", error);
      setAuthError("Failed to join family. Please try again.");
    } finally {
      setIsJoining(false);
    }
  };

  const handleLogout = () => {
    signOut(auth);
    setInviteCode('');
    setFamilyName('');
    setAuthError(null);
    setReportStartDate(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    setReportEndDate(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
    setIsCustomRange(false);
  };

  const handleSaveExpense = async (e: FormEvent) => {
    e.preventDefault();
    if (!newItem || !newAmount || !user || !profile?.familyId) return;

    const expenseData: any = {
      item: newItem,
      category: newCategory === 'Custom...' ? customCategory : newCategory,
      amount: parseFloat(newAmount),
      date: newDate,
      paymentMode: newPaymentMode,
      cardId: newPaymentMode === 'Credit Card' ? selectedCardId : null,
      bankId: (newPaymentMode === 'Bank' || newPaymentMode === 'UPI') ? selectedBankId : null,
      updated_at: new Date().toISOString(),
      added_by: user.uid
    };

    if (!editingExpense) {
      expenseData.created_at = new Date().toISOString();
    }

    if (newQuantity) {
      expenseData.quantity = parseFloat(newQuantity);
      expenseData.unit = newUnit;
    } else {
      expenseData.quantity = null;
      expenseData.unit = null;
    }

    try {
      if (editingExpense) {
        const expenseRef = ref(db, `families/${profile.familyId}/expenses/${editingExpense.id}`);
        await update(expenseRef, expenseData);
      } else {
        const expensesRef = ref(db, `families/${profile.familyId}/expenses`);
        const newExpenseRef = push(expensesRef);
        await set(newExpenseRef, expenseData);
      }
      
      setShowAddModal(false);
      setEditingExpense(null);
      resetForm();
    } catch (error) {
      console.error('Failed to save expense:', error);
    }
  };

  const resetForm = () => {
    setNewItem('');
    setNewCategory(CATEGORIES[0]);
    setCustomCategory('');
    setNewAmount('');
    setNewQuantity('');
    setNewUnit(UNITS[0]);
    setNewPaymentMode(PAYMENT_MODES[0]);
    setSelectedCardId('');
    setSelectedBankId('');
    setNewDate(format(new Date(), 'yyyy-MM-dd'));
    setEditingExpense(null);
  };

  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setNewItem(expense.item);
    
    if (dynamicCategories.includes(expense.category) && expense.category !== 'Custom...') {
      setNewCategory(expense.category);
      setCustomCategory('');
    } else {
      setNewCategory('Custom...');
      setCustomCategory(expense.category);
    }
    
    setNewAmount(expense.amount.toString());
    setNewQuantity(expense.quantity?.toString() || '');
    setNewUnit(expense.unit || UNITS[0]);
    setNewPaymentMode(expense.paymentMode || PAYMENT_MODES[0]);
    setSelectedCardId(expense.cardId || '');
    setSelectedBankId(expense.bankId || '');
    setNewDate(expense.date);
    setShowAddModal(true);
  };

  const handleDeleteExpense = async (id: string) => {
    if (!user || !profile?.familyId) return;
    if (!window.confirm('Are you sure you want to delete this expense?')) return;
    try {
      const expenseRef = ref(db, `families/${profile.familyId}/expenses/${id}`);
      await remove(expenseRef);
    } catch (error) {
      console.error('Failed to delete expense:', error);
    }
  };

  const handleSaveCard = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !profile?.familyId) return;

    const cardData = {
      name: newCardName,
      limit: parseFloat(newCardLimit),
      billDate: newCardBillDate,
      dueDate: newCardDueDate,
      lastUpdated: new Date().toISOString(),
    };

    try {
      if (editingCard) {
        const cardRef = ref(db, `families/${profile.familyId}/creditCards/${editingCard.id}`);
        await update(cardRef, cardData);
      } else {
        const cardsRef = ref(db, `families/${profile.familyId}/creditCards`);
        const newCardRef = push(cardsRef);
        await set(newCardRef, cardData);
      }
      
      setShowCardModal(false);
      setEditingCard(null);
      setNewCardName('');
      setNewCardLimit('');
      setNewCardBillDate('1');
      setNewCardDueDate('1');
      setNewCardDueAmount('');
    } catch (error) {
      console.error('Failed to save card:', error);
    }
  };

  const handleEditCard = (card: CreditCard) => {
    setEditingCard(card);
    setNewCardName(card.name);
    setNewCardLimit(card.limit?.toString() || '');
    setNewCardBillDate(card.billDate || '1');
    setNewCardDueDate(card.dueDate);
    setShowCardModal(true);
  };

  const handleSaveBank = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !profile?.familyId) return;

    const bankData = {
      name: newBankName,
      initialBalance: parseFloat(newBankInitialBalance) || 0,
      lastUpdated: new Date().toISOString(),
    };

    try {
      if (editingBank) {
        await update(ref(db, `families/${profile.familyId}/banks/${editingBank.id}`), bankData);
      } else {
        await set(push(ref(db, `families/${profile.familyId}/banks`)), bankData);
      }
      setShowBankModal(false);
      setEditingBank(null);
      setNewBankName('');
      setNewBankInitialBalance('');
    } catch (error) {
      console.error('Failed to save bank:', error);
    }
  };

  const handleDeleteBank = async (id: string) => {
    if (!user || !profile?.familyId) return;
    if (!window.confirm('Are you sure you want to delete this bank? All linked transactions and expenses will remain but won\'t be linked to this bank anymore.')) return;
    try {
      await remove(ref(db, `families/${profile.familyId}/banks/${id}`));
    } catch (error) {
      console.error('Failed to delete bank:', error);
    }
  };

  const handleSaveBankTransaction = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !profile?.familyId || !selectedBankIdForTx) return;

    const txData: BankTransaction = {
      bankId: selectedBankIdForTx,
      amount: parseFloat(newTxAmount),
      type: 'credit',
      description: newTxDescription,
      date: newTxDate,
    };

    try {
      await set(push(ref(db, `families/${profile.familyId}/bankTransactions`)), txData);
      setShowBankTransactionModal(false);
      setNewTxAmount('');
      setNewTxDescription('');
      setNewTxDate(format(new Date(), 'yyyy-MM-dd'));
    } catch (error) {
      console.error('Failed to save bank transaction:', error);
    }
  };

  const getBankBalance = (bank: Bank) => {
    const credits = bankTransactions
      .filter(tx => tx.bankId === bank.id && tx.type === 'credit')
      .reduce((sum, tx) => sum + tx.amount, 0);
    
    const debits = expenses
      .filter(e => e.bankId === bank.id && (e.paymentMode === 'Bank' || e.paymentMode === 'UPI'))
      .reduce((sum, e) => sum + e.amount, 0);
      
    return bank.initialBalance + credits - debits;
  };

  const handleDeleteCard = async (id: string) => {
    if (!user || !profile?.familyId) return;
    if (!window.confirm('Are you sure you want to delete this credit card? All linked expenses will remain but won\'t be linked to this card anymore.')) return;
    try {
      const cardRef = ref(db, `families/${profile.familyId}/creditCards/${id}`);
      await remove(cardRef);
    } catch (error) {
      console.error('Failed to delete card:', error);
    }
  };

  const copyInviteCode = () => {
    if (family?.inviteCode) {
      navigator.clipboard.writeText(family.inviteCode);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleGetSuggestions = async () => {
    setIsSuggesting(true);
    const text = await getSavingsSuggestions(expenses);
    setSuggestions(text || null);
    setIsSuggesting(false);
  };

  const downloadReport = () => {
    const doc = new jsPDF();
    const title = `Expense Report (${reportStartDate} to ${reportEndDate})`;
    
    doc.setFontSize(18);
    doc.text(title, 14, 22);
    
    doc.setFontSize(12);
    doc.text(`Total Spending: Rs. ${totalInRange.toLocaleString()}`, 14, 32);
    doc.text(`Generated on: ${format(new Date(), 'PPP p')}`, 14, 40);

    const tableData = filteredExpenses.map(e => [
      format(parseISO(e.date), 'dd/MM/yyyy'),
      e.item,
      e.category,
      e.paymentMode || 'N/A',
      `Rs. ${e.amount.toLocaleString()}`
    ]);

    autoTable(doc, {
      startY: 50,
      head: [['Date', 'Item', 'Category', 'Payment Mode', 'Amount']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [124, 58, 237] }, // Violet-600
    });

    doc.save(`GharKharch_Report_${reportStartDate}_to_${reportEndDate}.pdf`);
  };

  const getCardDueAmount = (card: CreditCard, allExpenses: Expense[]) => {
    if (!card.billDate) return 0;
    
    const billDay = parseInt(card.billDate);
    const today = new Date();
    const currentDay = today.getDate();
    
    let cycleStart: Date;
    let cycleEnd: Date;
    
    // If today is after the bill date, the current cycle started this month
    if (currentDay > billDay) {
      cycleStart = startOfDay(setDate(today, billDay + 1));
      cycleEnd = startOfDay(setDate(addMonths(today, 1), billDay));
    } else {
      // If today is on or before the bill date, the current cycle started last month
      cycleStart = startOfDay(setDate(subMonths(today, 1), billDay + 1));
      cycleEnd = startOfDay(setDate(today, billDay));
    }
    
    return allExpenses
      .filter(e => e.cardId === card.id)
      .filter(e => {
        const expenseDate = parseISO(e.date);
        return isWithinInterval(expenseDate, { start: cycleStart, end: cycleEnd });
      })
      .reduce((sum, e) => sum + e.amount, 0);
  };

  const filteredExpenses = expenses.filter(e => {
    const date = parseISO(e.date);
    const inRange = isWithinInterval(date, {
      start: parseISO(reportStartDate),
      end: parseISO(reportEndDate),
    });
    const matchesSearch = e.item.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         e.category.toLowerCase().includes(searchQuery.toLowerCase());
    return inRange && matchesSearch;
  });

  const displayExpenses = expenses.filter(e => {
    return e.item.toLowerCase().includes(searchQuery.toLowerCase()) || 
           e.category.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const totalInRange = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  const totalThisMonth = expenses
    .filter(e => {
      const date = parseISO(e.date);
      return isWithinInterval(date, {
        start: startOfMonth(new Date()),
        end: endOfMonth(new Date()),
      });
    })
    .reduce((sum, e) => sum + e.amount, 0);

  // Get unique categories from expenses that aren't in the default list
  const customCategoriesFromData = (Array.from(new Set(expenses.map(e => e.category))) as string[])
    .filter(cat => !CATEGORIES.includes(cat));
  
  const dynamicCategories = [...CATEGORIES.filter(c => c !== 'Custom...'), ...customCategoriesFromData, 'Custom...'];

  const chartData = (Array.from(new Set(filteredExpenses.map(e => e.category))) as string[])
    .map(cat => ({
      name: cat,
      value: filteredExpenses.filter(e => e.category === cat).reduce((sum, e) => sum + e.amount, 0),
    }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value);

  const dailyData = filteredExpenses.reduce((acc: any[], e) => {
    const date = format(parseISO(e.date), 'MMM dd');
    const existing = acc.find(d => d.date === date);
    if (existing) {
      existing.amount += e.amount;
    } else {
      acc.push({ date, amount: e.amount });
    }
    return acc;
  }, []).slice(0, 7).reverse();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#f7f9fc] flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f7f9fc] flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white w-full max-w-md rounded-[32px] p-8 shadow-2xl shadow-violet-100 border border-slate-100"
        >
          <div className="flex flex-col items-center mb-10">
            <div className="w-20 h-20 bg-violet-600 rounded-[24px] flex items-center justify-center text-white shadow-xl shadow-violet-200 mb-6 rotate-3">
              <IndianRupee size={40} />
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-900">GharKharch</h1>
            <p className="text-slate-500 font-medium mt-2">Family Expense Tracker</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-5">
            {isSignUp && (
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700 ml-1">Full Name</label>
                <div className="relative">
                  <input 
                    required
                    type="text" 
                    placeholder="Your Name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-4 pl-12 focus:border-violet-600 focus:bg-white transition-all font-medium outline-none"
                  />
                  <UserIcon size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700 ml-1">Email Address</label>
              <div className="relative">
                <input 
                  required
                  type="email" 
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-4 pl-12 focus:border-violet-600 focus:bg-white transition-all font-medium outline-none"
                />
                <Mail size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700 ml-1">Password</label>
              <div className="relative">
                <input 
                  required
                  type="password" 
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-4 pl-12 focus:border-violet-600 focus:bg-white transition-all font-medium outline-none"
                />
                <Lock size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            {authError && (
              <motion.p 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-rose-500 text-sm font-bold bg-rose-50 p-3 rounded-xl border border-rose-100"
              >
                {authError}
              </motion.p>
            )}

            <button 
              type="submit"
              className="w-full bg-violet-600 text-white py-5 rounded-2xl font-black text-xl shadow-xl shadow-violet-200 hover:bg-violet-700 active:scale-95 transition-all mt-4"
            >
              {isSignUp ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <div className="mt-8 text-center">
            <button 
              onClick={() => { setIsSignUp(!isSignUp); setAuthError(null); }}
              className="text-sm font-bold text-violet-600 hover:text-violet-800 transition-colors"
            >
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Family Setup Screen
  if (profile && !profile.familyId) {
    return (
      <div className="min-h-screen bg-[#f7f9fc] p-6 flex flex-col items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white w-full max-w-md rounded-[32px] p-8 shadow-2xl border border-slate-100"
        >
          <h2 className="text-3xl font-black text-slate-900 mb-2">Welcome, {profile.displayName}!</h2>
          <p className="text-slate-500 font-medium mb-10">To start tracking expenses, join a family or create a new one.</p>

          <div className="space-y-10">
            <form onSubmit={handleJoinFamily} className="space-y-4">
              <h3 className="font-black text-slate-800 flex items-center gap-2">
                <Users size={20} className="text-violet-600" />
                Join Existing Family
              </h3>
              <div className="flex flex-col sm:flex-row gap-3">
                <input 
                  autoFocus
                  required
                  type="text" 
                  placeholder="6-DIGIT CODE"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck="false"
                  maxLength={6}
                  pattern="[A-Za-z0-9]*"
                  className="flex-1 bg-slate-50 border-2 border-transparent rounded-2xl p-4 focus:border-violet-600 focus:bg-white transition-all font-bold tracking-[0.2em] outline-none text-center uppercase"
                />
                <button 
                  type="submit"
                  disabled={isJoining}
                  className="bg-violet-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-violet-700 active:scale-95 transition-all shadow-lg shadow-violet-100 disabled:opacity-50 disabled:pointer-events-none min-w-[100px]"
                >
                  {isJoining ? (
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-5 h-5 border-2 border-white border-t-transparent rounded-full mx-auto"
                    />
                  ) : 'Join'}
                </button>
              </div>
            </form>

            {authError && (
              <motion.p 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-rose-500 text-sm font-bold bg-rose-50 p-3 rounded-xl border border-rose-100"
              >
                {authError}
              </motion.p>
            )}

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-slate-400 font-bold uppercase tracking-widest">OR</span>
              </div>
            </div>

            <form onSubmit={handleCreateFamily} className="space-y-4">
              <h3 className="font-black text-slate-800 flex items-center gap-2">
                <Plus size={20} className="text-violet-600" />
                Create New Family
              </h3>
              <div className="flex flex-col sm:flex-row gap-3">
                <input 
                  required
                  type="text" 
                  placeholder="Family Name"
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  className="flex-1 bg-slate-50 border-2 border-transparent rounded-2xl p-4 focus:border-violet-600 focus:bg-white transition-all font-medium outline-none"
                />
                <button 
                  type="submit"
                  className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold hover:bg-violet-800 active:scale-95 transition-all shadow-lg shadow-slate-100"
                >
                  Create
                </button>
              </div>
            </form>
          </div>

          <button 
            onClick={handleLogout}
            className="w-full mt-12 text-slate-400 font-bold text-sm hover:text-slate-600 transition-colors flex items-center justify-center gap-2"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f9fc] text-slate-900 font-sans pb-28">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-30 px-6 py-4">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-violet-100">
              <IndianRupee size={22} />
            </div>
            <div>
              <h1 className="font-black text-xl tracking-tight leading-none">GharKharch</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{family?.name || 'Family'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setActiveTab('profile')}
              className={cn(
                "w-10 h-10 rounded-xl transition-all flex items-center justify-center overflow-hidden border-2",
                activeTab === 'profile' ? "border-violet-600 bg-violet-50" : "border-transparent text-slate-400 hover:bg-slate-50"
              )}
            >
              {profile?.photoURL ? (
                <img src={profile.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <UserIcon size={22} />
              )}
            </button>
            <button 
              onClick={() => setActiveTab('cards')}
              className={cn(
                "p-2.5 rounded-xl transition-all",
                activeTab === 'cards' ? "bg-violet-50 text-violet-600" : "text-slate-400 hover:bg-slate-50"
              )}
            >
              <CreditCardIcon size={22} />
            </button>
            <button 
              onClick={() => setActiveTab('family')}
              className={cn(
                "p-2.5 rounded-xl transition-all",
                activeTab === 'family' ? "bg-violet-50 text-violet-600" : "text-slate-400 hover:bg-slate-50"
              )}
            >
              <Users size={22} />
            </button>
            <button 
              onClick={handleLogout}
              className="p-2.5 text-slate-400 hover:text-rose-500 transition-colors"
            >
              <LogOut size={22} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-6 space-y-6">
        {(activeTab === 'list' || activeTab === 'stats') && (
          <>
            {/* Summary Card */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-violet-600 rounded-[32px] p-8 text-white shadow-2xl shadow-violet-200 relative overflow-hidden"
            >
              <div className="relative z-10">
                <p className="text-violet-200 text-sm font-bold uppercase tracking-widest mb-1">
                  {activeTab === 'stats' ? 'Selected Range Spending' : "This Month's Spending"}
                </p>
                <h2 className="text-5xl font-black tracking-tight mb-6">
                  ₹{(activeTab === 'stats' ? totalInRange : totalThisMonth).toLocaleString()}
                </h2>
                
                <div className="grid grid-cols-2 gap-6 pt-6 border-t border-violet-500/30">
                  <div>
                    <p className="text-violet-300 text-[10px] uppercase font-black tracking-widest mb-1">Transactions</p>
                    <p className="text-xl font-bold">{(activeTab === 'stats' ? filteredExpenses : expenses).length}</p>
                  </div>
                  <div>
                    <p className="text-violet-300 text-[10px] uppercase font-black tracking-widest mb-1">Daily Average</p>
                    <p className="text-xl font-bold">₹{Math.round((activeTab === 'stats' ? totalInRange : totalThisMonth) / 30).toLocaleString()}</p>
                  </div>
                </div>
              </div>
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
            </motion.div>

            {/* AI Suggestions */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-[28px] p-6 shadow-xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden"
            >
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600">
                    <Sparkles size={18} />
                  </div>
                  <h3 className="font-black text-slate-800">Savings Assistant</h3>
                </div>
                
                {suggestions ? (
                  <div className="text-slate-600 text-sm leading-relaxed whitespace-pre-line bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    {suggestions}
                    <button 
                      onClick={() => setSuggestions(null)}
                      className="mt-4 text-xs font-black uppercase tracking-widest text-violet-600 hover:text-violet-800 block"
                    >
                      Dismiss
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-slate-500 text-sm font-medium">Get AI insights on your spending habits.</p>
                    <button 
                      onClick={handleGetSuggestions}
                      disabled={isSuggesting || expenses.length === 0}
                      className="bg-violet-600 text-white px-5 py-3 rounded-2xl font-bold text-sm hover:bg-violet-700 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2 whitespace-nowrap shadow-lg shadow-violet-100"
                    >
                      {isSuggesting ? 'Analyzing...' : 'Analyze'}
                      {!isSuggesting && <ChevronRight size={16} />}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}

        {/* Content Section */}
        <AnimatePresence mode="wait">
          {activeTab === 'list' ? (
            <motion.div 
              key="list"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                  type="text"
                  placeholder="Search items or categories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-100 rounded-2xl py-4 pl-12 pr-4 shadow-sm focus:border-violet-600 focus:ring-1 focus:ring-violet-600 outline-none transition-all font-medium"
                />
              </div>

              <div className="flex items-center justify-between px-2">
                <h3 className="font-black text-slate-900 text-lg">Recent Expenses</h3>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{displayExpenses.length} Total</span>
              </div>

              {displayExpenses.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-[32px] border-2 border-dashed border-slate-200">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <IndianRupee size={40} className="text-slate-200" />
                  </div>
                  <h3 className="font-black text-slate-900 text-xl">No expenses found</h3>
                  <p className="text-slate-400 font-medium mt-2">Try a different search or start tracking</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {displayExpenses.map((expense) => (
                    <motion.div 
                      layout
                      key={expense.id}
                      className="bg-white p-5 rounded-[24px] shadow-sm border border-slate-100 flex items-center justify-between group hover:shadow-md transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg",
                          expense.category === 'Vegetables' ? 'bg-emerald-500 shadow-emerald-100' :
                          expense.category === 'Groceries' ? 'bg-blue-500 shadow-blue-100' :
                          expense.category === 'Utilities' ? 'bg-orange-500 shadow-orange-100' :
                          expense.category === 'Dining' ? 'bg-rose-500 shadow-rose-100' :
                          expense.category === 'Dairy' ? 'bg-sky-500 shadow-sky-100' :
                          expense.category === 'Snacks' ? 'bg-amber-500 shadow-amber-100' : 'bg-slate-500 shadow-slate-100'
                        )}>
                          <Tag size={24} />
                        </div>
                        <div>
                          <h4 className="font-black text-slate-900">{expense.item}</h4>
                          <div className="flex items-center gap-2 text-xs text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                            <span>{expense.category}</span>
                            <span>•</span>
                            <span>{format(parseISO(expense.date), 'MMM dd')}</span>
                            {expense.paymentMode && (
                              <>
                                <span>•</span>
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[9px] font-black text-slate-500 uppercase tracking-tighter">{expense.paymentMode}</span>
                              </>
                            )}
                            {expense.quantity && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-0.5 text-violet-500">
                                  <Scale size={12} />
                                  {expense.quantity}{expense.unit}
                                </span>
                              </>
                            )}
                            {expense.added_by && (
                              <>
                                <span>•</span>
                                <span className="text-violet-400 lowercase italic flex items-center gap-1">
                                  {memberProfiles[expense.added_by]?.photoURL && (
                                    <img src={memberProfiles[expense.added_by].photoURL} alt="" className="w-3 h-3 rounded-full object-cover" referrerPolicy="no-referrer" />
                                  )}
                                  by {memberProfiles[expense.added_by]?.name || '...'}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="font-black text-xl text-slate-900">₹{expense.amount}</p>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleEditExpense(expense)}
                            className="p-2 text-slate-300 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-all"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={() => handleDeleteExpense(expense.id!)}
                            className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : activeTab === 'banks' ? (
            <motion.div 
              key="banks"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between px-2">
                <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                  <Building2 size={20} className="text-violet-600" />
                  Bank Accounts
                </h3>
                <div className="flex gap-2">
                  <button 
                    onClick={() => { setShowBankTransactionModal(true); }}
                    className="bg-slate-900 text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-slate-800 active:scale-95 transition-all flex items-center gap-2 shadow-lg shadow-slate-100"
                  >
                    <Plus size={14} /> Credit Entry
                  </button>
                  <button 
                    onClick={() => { setEditingBank(null); setShowBankModal(true); }}
                    className="bg-violet-600 text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-violet-700 active:scale-95 transition-all flex items-center gap-2 shadow-lg shadow-violet-100"
                  >
                    <Plus size={14} /> Add Bank
                  </button>
                </div>
              </div>

              {banks.length > 0 && (
                <div className="bg-violet-600 p-8 rounded-[32px] text-white relative overflow-hidden shadow-2xl shadow-violet-200 mb-6">
                  <div className="relative z-10">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-200 mb-2">Total Bank Balance</p>
                    <h2 className="text-4xl font-black">₹{banks.reduce((sum, bank) => sum + getBankBalance(bank), 0).toLocaleString()}</h2>
                  </div>
                  <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/20 rounded-full blur-3xl" />
                  <div className="absolute right-8 top-1/2 -translate-y-1/2 opacity-20">
                    <Building2 size={80} />
                  </div>
                </div>
              )}

              {banks.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-[32px] border-2 border-dashed border-slate-200">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Building2 size={40} className="text-slate-200" />
                  </div>
                  <h3 className="font-black text-slate-900 text-xl">No banks added</h3>
                  <p className="text-slate-400 font-medium mt-2">Manage your bank balances and auto-debits</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {banks.map((bank) => {
                    const balance = getBankBalance(bank);
                    const bankCredits = bankTransactions.filter(tx => tx.bankId === bank.id && tx.type === 'credit');
                    const bankDebits = expenses.filter(e => e.bankId === bank.id && (e.paymentMode === 'Bank' || e.paymentMode === 'UPI'));

                    return (
                      <motion.div 
                        layout
                        key={bank.id}
                        className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 relative overflow-hidden group"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-600">
                              <Building2 size={24} />
                            </div>
                            <div>
                              <h4 className="font-black text-slate-900">{bank.name}</h4>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                Initial: ₹{bank.initialBalance.toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => {
                                setEditingBank(bank);
                                setNewBankName(bank.name);
                                setNewBankInitialBalance(bank.initialBalance.toString());
                                setShowBankModal(true);
                              }}
                              className="p-2 text-slate-300 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-all"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button 
                              onClick={() => handleDeleteBank(bank.id!)}
                              className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                          <div className="bg-emerald-50 p-3 rounded-2xl">
                            <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest mb-1 flex items-center gap-1">
                              <ArrowUpRight size={10} /> Credits
                            </p>
                            <p className="text-lg font-black text-emerald-700">₹{bankCredits.reduce((sum, tx) => sum + tx.amount, 0).toLocaleString()}</p>
                          </div>
                          <div className="bg-rose-50 p-3 rounded-2xl">
                            <p className="text-[10px] text-rose-600 font-black uppercase tracking-widest mb-1 flex items-center gap-1">
                              <ArrowDownLeft size={10} /> Debits
                            </p>
                            <p className="text-lg font-black text-rose-700">₹{bankDebits.reduce((sum, e) => sum + e.amount, 0).toLocaleString()}</p>
                          </div>
                        </div>

                        <div className="flex items-end justify-between pt-4 border-t border-slate-50">
                          <div>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Current Balance</p>
                            <p className="text-2xl font-black text-slate-900">₹{balance.toLocaleString()}</p>
                          </div>
                          <div className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                            balance > 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                          )}>
                            {balance > 0 ? 'Healthy' : 'Low Balance'}
                          </div>
                        </div>

                        {/* Mini Transaction History */}
                        <div className="mt-6 space-y-2">
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2">Recent Activity</p>
                          {[...bankCredits, ...bankDebits]
                            .sort((a, b) => new Date('date' in b ? b.date : b.date).getTime() - new Date('date' in a ? a.date : a.date).getTime())
                            .slice(0, 3)
                            .map((item, idx) => {
                              const isTx = 'type' in item;
                              const amount = isTx ? item.amount : item.amount;
                              const desc = isTx ? item.description : item.item;
                              const date = isTx ? item.date : item.date;
                              const type = isTx ? 'credit' : 'debit';

                              return (
                                <div key={idx} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl transition-colors">
                                  <div className="flex items-center gap-2">
                                    <div className={cn(
                                      "w-6 h-6 rounded-lg flex items-center justify-center",
                                      type === 'credit' ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                                    )}>
                                      {type === 'credit' ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />}
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-black text-slate-700 truncate max-w-[120px]">{desc}</p>
                                      <p className="text-[8px] text-slate-400 font-bold">{format(parseISO(date), 'dd MMM')}</p>
                                    </div>
                                  </div>
                                  <p className={cn(
                                    "text-[10px] font-black",
                                    type === 'credit' ? "text-emerald-600" : "text-rose-600"
                                  )}>
                                    {type === 'credit' ? '+' : '-'}₹{amount.toLocaleString()}
                                  </p>
                                </div>
                              );
                            })
                          }
                          {(bankCredits.length + bankDebits.length) === 0 && (
                            <p className="text-[10px] text-slate-300 italic text-center py-2">No transactions yet</p>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          ) : activeTab === 'stats' ? (
            <motion.div 
              key="stats"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Date Range Picker */}
              <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-black text-slate-900 flex items-center gap-2">
                    <Calendar size={18} className="text-violet-600" />
                    Report Range
                  </h3>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={downloadReport}
                      className="bg-slate-900 text-white p-2 rounded-xl hover:bg-violet-600 transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
                    >
                      <Download size={14} /> PDF
                    </button>
                    <button 
                      onClick={() => {
                        setReportStartDate(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
                        setReportEndDate(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
                      }}
                      className="text-[10px] font-black text-violet-600 uppercase tracking-widest hover:bg-violet-50 px-3 py-1.5 rounded-full transition-all"
                    >
                      Reset
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">From</label>
                    <input 
                      type="date" 
                      value={reportStartDate}
                      onChange={(e) => setReportStartDate(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-3 focus:border-violet-600 focus:bg-white transition-all font-bold text-sm outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">To</label>
                    <input 
                      type="date" 
                      value={reportEndDate}
                      onChange={(e) => setReportEndDate(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-3 focus:border-violet-600 focus:bg-white transition-all font-bold text-sm outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100">
                <h3 className="font-black text-slate-900 mb-8 flex items-center gap-2 text-lg">
                  <PieChartIcon size={20} className="text-violet-600" />
                  Category Breakdown
                </h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={90}
                        paddingAngle={8}
                        dataKey="value"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px 16px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-8">
                  {chartData.map((data, index) => (
                    <div key={data.name} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        <span className="text-xs font-black text-slate-600 uppercase tracking-widest">{data.name}</span>
                      </div>
                      <span className="text-xs font-black text-slate-900">₹{data.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100">
                <h3 className="font-black text-slate-900 mb-8 flex items-center gap-2 text-lg">
                  <BarChart3 size={20} className="text-violet-600" />
                  Weekly Trend
                </h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyData}>
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }} />
                      <YAxis hide />
                      <RechartsTooltip 
                        cursor={{ fill: '#f8fafc', radius: 12 }}
                        contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px 16px' }}
                      />
                      <Bar dataKey="amount" fill="#7c3aed" radius={[10, 10, 10, 10]} barSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>
          ) : activeTab === 'family' ? (
            <motion.div 
              key="family"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                    <Users size={20} className="text-violet-600" />
                    Family Settings
                  </h3>
                  <div className="bg-violet-50 text-violet-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                    {profile?.role}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Invite Code</p>
                    <div className="flex items-center justify-between">
                      <span className="text-3xl font-black text-slate-900 tracking-widest">{family?.inviteCode}</span>
                      <button 
                        onClick={copyInviteCode}
                        className="bg-white p-3 rounded-2xl border border-slate-200 text-slate-600 hover:text-violet-600 transition-all active:scale-90 shadow-sm"
                      >
                        {copySuccess ? <Check size={20} className="text-emerald-500" /> : <Copy size={20} />}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold mt-3">Share this code with family members to join.</p>
                  </div>

                  <div>
                    <h4 className="font-black text-slate-800 mb-4 px-1">Family Members</h4>
                    <div className="space-y-2">
                      {family?.members && Object.keys(family.members).map((memberUid) => (
                        <div key={memberUid} className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-100">
                          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 overflow-hidden">
                            {memberProfiles[memberUid]?.photoURL ? (
                              <img src={memberProfiles[memberUid].photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <UserIcon size={20} />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900">{memberProfiles[memberUid]?.name || `Member ${memberUid.substring(0, 5)}`}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                              {memberUid === family.adminUid ? 'Admin' : 'Member'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : activeTab === 'cards' ? (
            <motion.div 
              key="cards"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between px-2">
                <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                  <CreditCardIcon size={20} className="text-violet-600" />
                  Credit Cards
                </h3>
                <button 
                  onClick={() => { setEditingCard(null); setShowCardModal(true); }}
                  className="bg-violet-600 text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-violet-700 active:scale-95 transition-all flex items-center gap-2 shadow-lg shadow-violet-100"
                >
                  <Plus size={14} /> Add Card
                </button>
              </div>

              {creditCards.length > 0 && (
                <div className="bg-slate-900 p-8 rounded-[32px] text-white relative overflow-hidden shadow-2xl shadow-slate-200 mb-6">
                  <div className="relative z-10">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Total Credit Due</p>
                    <h2 className="text-4xl font-black">₹{creditCards.reduce((sum, card) => sum + card.dueAmount, 0).toLocaleString()}</h2>
                  </div>
                  <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-violet-600/20 rounded-full blur-3xl" />
                  <div className="absolute right-8 top-1/2 -translate-y-1/2 opacity-20">
                    <CreditCardIcon size={80} />
                  </div>
                </div>
              )}

              {creditCards.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-[32px] border-2 border-dashed border-slate-200">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CreditCardIcon size={40} className="text-slate-200" />
                  </div>
                  <h3 className="font-black text-slate-900 text-xl">No cards added</h3>
                  <p className="text-slate-400 font-medium mt-2">Track your credit card dues easily</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {creditCards.map((card) => {
                    const cardExpenses = expenses.filter(e => e.cardId === card.id);
                    const cardTotal = cardExpenses.reduce((sum, e) => sum + e.amount, 0);
                    const autoDue = getCardDueAmount(card, expenses);
                    const usagePercent = Math.min(Math.round((cardTotal / card.limit) * 100), 100);

                    return (
                      <motion.div 
                        layout
                        key={card.id}
                        className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 relative overflow-hidden group"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white">
                              <CreditCardIcon size={24} />
                            </div>
                            <div>
                              <h4 className="font-black text-slate-900">{card.name}</h4>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                Bill: {card.billDate}th • Due: {card.dueDate}th
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleEditCard(card)}
                              className="p-2 text-slate-300 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-all"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button 
                              onClick={() => handleDeleteCard(card.id!)}
                              className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                          <div>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Limit</p>
                            <p className="text-lg font-black text-slate-900">₹{card.limit?.toLocaleString()}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Current Usage</p>
                            <p className="text-lg font-black text-violet-600">₹{cardTotal.toLocaleString()}</p>
                          </div>
                        </div>

                        <div className="space-y-2 mb-6">
                          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                            <span className="text-slate-400">Usage</span>
                            <span className={cn(usagePercent > 80 ? "text-rose-500" : "text-violet-600")}>{usagePercent}%</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${usagePercent}%` }}
                              className={cn("h-full transition-all", usagePercent > 80 ? "bg-rose-500" : "bg-violet-600")}
                            />
                          </div>
                        </div>

                        <div className="flex items-end justify-between pt-4 border-t border-slate-50">
                          <div>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Statement Due (Auto)</p>
                            <p className="text-2xl font-black text-slate-900">₹{autoDue.toLocaleString()}</p>
                          </div>
                          <div className="bg-rose-50 text-rose-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                            Unpaid
                          </div>
                        </div>
                        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-slate-50 rounded-full blur-2xl -z-10" />
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          ) : activeTab === 'profile' ? (
            <motion.div 
              key="profile"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100">
                <h3 className="font-black text-slate-900 text-lg mb-8 flex items-center gap-2">
                  <UserIcon size={20} className="text-violet-600" />
                  My Profile
                </h3>

                <form onSubmit={handleUpdateProfile} className="space-y-6">
                  <div className="flex flex-col items-center gap-4 mb-8">
                    <div className="w-24 h-24 bg-slate-100 rounded-[32px] flex items-center justify-center text-slate-400 overflow-hidden border-4 border-white shadow-xl">
                      {editPhotoURL ? (
                        <img src={editPhotoURL} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <UserIcon size={40} />
                      )}
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Profile Preview</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-700 ml-1">Display Name</label>
                    <input 
                      required
                      type="text" 
                      placeholder="Your Name"
                      value={editDisplayName}
                      onChange={(e) => setEditDisplayName(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-4 focus:border-violet-600 focus:bg-white transition-all font-medium outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-700 ml-1">Profile Photo URL</label>
                    <input 
                      type="url" 
                      placeholder="https://example.com/photo.jpg"
                      value={editPhotoURL}
                      onChange={(e) => setEditPhotoURL(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-4 focus:border-violet-600 focus:bg-white transition-all font-medium outline-none"
                    />
                    <p className="text-[10px] text-slate-400 font-bold ml-1">Paste a link to an image (e.g. from Google Photos, Pinterest, etc.)</p>
                  </div>

                  <button 
                    type="submit"
                    disabled={isUpdatingProfile}
                    className="w-full bg-slate-900 text-white p-5 rounded-2xl font-black text-lg hover:bg-violet-800 active:scale-95 transition-all shadow-xl shadow-slate-100 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {isUpdatingProfile ? 'Updating...' : 'Save Changes'}
                  </button>
                </form>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>

      {/* Bank Modal */}
      <AnimatePresence>
        {showBankModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowBankModal(false); setEditingBank(null); }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="relative bg-white w-full max-w-md rounded-t-[40px] sm:rounded-[40px] p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-black text-slate-900">{editingBank ? 'Edit Bank' : 'Add Bank'}</h2>
                <button 
                  onClick={() => { setShowBankModal(false); setEditingBank(null); }}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                >
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>

              <form onSubmit={handleSaveBank} className="space-y-6">
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-slate-700 ml-1">Bank Name</label>
                  <input 
                    required
                    type="text" 
                    placeholder="e.g. SBI, HDFC, ICICI"
                    value={newBankName}
                    onChange={(e) => setNewBankName(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-4 focus:border-violet-600 focus:bg-white transition-all font-medium outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-slate-700 ml-1">Initial Balance (₹)</label>
                  <input 
                    required
                    type="number" 
                    placeholder="0.00"
                    value={newBankInitialBalance}
                    onChange={(e) => setNewBankInitialBalance(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-4 focus:border-violet-600 focus:bg-white transition-all font-black text-xl outline-none"
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full bg-violet-600 text-white py-5 rounded-2xl font-black text-xl shadow-xl shadow-violet-100 hover:bg-violet-700 active:scale-95 transition-all mt-4"
                >
                  {editingBank ? 'Update Bank' : 'Save Bank'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bank Transaction Modal */}
      <AnimatePresence>
        {showBankTransactionModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowBankTransactionModal(false); }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="relative bg-white w-full max-w-md rounded-t-[40px] sm:rounded-[40px] p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-black text-slate-900">Credit Entry</h2>
                <button 
                  onClick={() => { setShowBankTransactionModal(false); }}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                >
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>

              <form onSubmit={handleSaveBankTransaction} className="space-y-6">
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-slate-700 ml-1">Select Bank</label>
                  <div className="relative">
                    <select 
                      required
                      value={selectedBankIdForTx}
                      onChange={(e) => setSelectedBankIdForTx(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-4 focus:border-violet-600 focus:bg-white transition-all font-bold outline-none appearance-none"
                    >
                      <option value="">Choose a bank...</option>
                      {banks.map(bank => (
                        <option key={bank.id} value={bank.id}>{bank.name}</option>
                      ))}
                    </select>
                    <ChevronRight size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-slate-700 ml-1">Credit Amount (₹)</label>
                  <input 
                    required
                    type="number" 
                    placeholder="0.00"
                    value={newTxAmount}
                    onChange={(e) => setNewTxAmount(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-4 focus:border-violet-600 focus:bg-white transition-all font-black text-xl outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-slate-700 ml-1">Description</label>
                  <input 
                    required
                    type="text" 
                    placeholder="e.g. Salary, Rent, Gift"
                    value={newTxDescription}
                    onChange={(e) => setNewTxDescription(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-4 focus:border-violet-600 focus:bg-white transition-all font-medium outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-slate-700 ml-1">Date</label>
                  <input 
                    required
                    type="date" 
                    value={newTxDate}
                    onChange={(e) => setNewTxDate(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-4 focus:border-violet-600 focus:bg-white transition-all font-bold outline-none"
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-black text-xl shadow-xl shadow-emerald-100 hover:bg-emerald-700 active:scale-95 transition-all mt-4"
                >
                  Add Credit
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Credit Card Modal */}
      <AnimatePresence>
        {showCardModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowCardModal(false); setEditingCard(null); }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="relative bg-white w-full max-w-md rounded-t-[40px] sm:rounded-[40px] p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-black text-slate-900">{editingCard ? 'Edit Card' : 'Add Card'}</h2>
                <button 
                  onClick={() => { setShowCardModal(false); setEditingCard(null); }}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                >
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>

              <form onSubmit={handleSaveCard} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-700 ml-1">Card Name</label>
                    <input 
                      required
                      type="text" 
                      placeholder="e.g. HDFC Millennia"
                      value={newCardName}
                      onChange={(e) => setNewCardName(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-4 focus:border-violet-600 focus:bg-white transition-all font-medium outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-700 ml-1">Limit (₹)</label>
                    <input 
                      required
                      type="number" 
                      placeholder="50000"
                      value={newCardLimit}
                      onChange={(e) => setNewCardLimit(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-4 focus:border-violet-600 focus:bg-white transition-all font-bold outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-700 ml-1">Bill Date</label>
                    <input 
                      required
                      type="number" 
                      min="1"
                      max="31"
                      placeholder="1-31"
                      value={newCardBillDate}
                      onChange={(e) => setNewCardBillDate(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-4 focus:border-violet-600 focus:bg-white transition-all font-bold outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-700 ml-1">Due Date</label>
                    <input 
                      required
                      type="number" 
                      min="1"
                      max="31"
                      placeholder="1-31"
                      value={newCardDueDate}
                      onChange={(e) => setNewCardDueDate(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-4 focus:border-violet-600 focus:bg-white transition-all font-bold outline-none"
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-xl shadow-xl shadow-slate-100 hover:bg-violet-800 active:scale-95 transition-all mt-4"
                >
                  {editingCard ? 'Update Card' : 'Save Card'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowAddModal(false); setEditingExpense(null); }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="relative bg-white w-full max-w-md rounded-t-[40px] sm:rounded-[40px] p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-black text-slate-900">{editingExpense ? 'Edit Expense' : 'Add Expense'}</h2>
                <button 
                  onClick={() => { setShowAddModal(false); setEditingExpense(null); }}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                >
                  <Plus size={24} className="rotate-45" />
                </button>
              </div>

              <form onSubmit={handleSaveExpense} className="space-y-6">
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-slate-700 ml-1">Item Name</label>
                  <input 
                    autoFocus
                    required
                    type="text" 
                    placeholder="e.g. Milk, Dinner, Light Bill"
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-4 focus:border-violet-600 focus:bg-white transition-all font-medium outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-700 ml-1">Category</label>
                    <div className="relative">
                      <select 
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-4 focus:border-violet-600 focus:bg-white transition-all font-bold outline-none appearance-none"
                      >
                        {dynamicCategories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                      <ChevronRight size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-700 ml-1">Amount (₹)</label>
                    <input 
                      required
                      type="number" 
                      placeholder="0.00"
                      value={newAmount}
                      onChange={(e) => setNewAmount(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-4 focus:border-violet-600 focus:bg-white transition-all font-black text-xl outline-none"
                    />
                  </div>
                </div>

                {newCategory === 'Custom...' && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-1.5"
                  >
                    <label className="text-sm font-bold text-slate-700 ml-1">Custom Category Name</label>
                    <input 
                      required
                      type="text" 
                      placeholder="Enter category name"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-4 focus:border-violet-600 focus:bg-white transition-all font-medium outline-none"
                    />
                  </motion.div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-700 ml-1">Quantity (Optional)</label>
                    <input 
                      type="number" 
                      placeholder="e.g. 500, 1"
                      value={newQuantity}
                      onChange={(e) => setNewQuantity(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-4 focus:border-violet-600 focus:bg-white transition-all font-medium outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-700 ml-1">Unit</label>
                    <div className="relative">
                      <select 
                        value={newUnit}
                        onChange={(e) => setNewUnit(e.target.value)}
                        className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-4 focus:border-violet-600 focus:bg-white transition-all font-bold outline-none appearance-none"
                      >
                        {UNITS.map(unit => (
                          <option key={unit} value={unit}>{unit}</option>
                        ))}
                      </select>
                      <ChevronRight size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-700 ml-1">Payment Mode</label>
                    <div className="relative">
                      <select 
                        value={newPaymentMode}
                        onChange={(e) => setNewPaymentMode(e.target.value as any)}
                        className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-4 focus:border-violet-600 focus:bg-white transition-all font-bold outline-none appearance-none"
                      >
                        {PAYMENT_MODES.map(mode => (
                          <option key={mode} value={mode}>{mode}</option>
                        ))}
                      </select>
                      <ChevronRight size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-700 ml-1">Date</label>
                    <div className="relative">
                      <input 
                        type="date" 
                        value={newDate}
                        onChange={(e) => setNewDate(e.target.value)}
                        className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-4 focus:border-violet-600 focus:bg-white transition-all font-bold outline-none appearance-none"
                      />
                      <Calendar size={20} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {newPaymentMode === 'Credit Card' && creditCards.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-1.5"
                  >
                    <label className="text-sm font-bold text-slate-700 ml-1">Select Card</label>
                    <div className="relative">
                      <select 
                        required
                        value={selectedCardId}
                        onChange={(e) => setSelectedCardId(e.target.value)}
                        className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-4 focus:border-violet-600 focus:bg-white transition-all font-bold outline-none appearance-none"
                      >
                        <option value="">Choose a card...</option>
                        {creditCards.map(card => (
                          <option key={card.id} value={card.id}>{card.name}</option>
                        ))}
                      </select>
                      <ChevronRight size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" />
                    </div>
                  </motion.div>
                )}

                {(newPaymentMode === 'Bank' || newPaymentMode === 'UPI') && banks.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-1.5"
                  >
                    <label className="text-sm font-bold text-slate-700 ml-1">Select Bank</label>
                    <div className="relative">
                      <select 
                        required
                        value={selectedBankId}
                        onChange={(e) => setSelectedBankId(e.target.value)}
                        className="w-full bg-slate-50 border-2 border-transparent rounded-2xl p-4 focus:border-violet-600 focus:bg-white transition-all font-bold outline-none appearance-none"
                      >
                        <option value="">Choose a bank...</option>
                        {banks.map(bank => (
                          <option key={bank.id} value={bank.id}>{bank.name} (₹{getBankBalance(bank).toLocaleString()})</option>
                        ))}
                      </select>
                      <ChevronRight size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" />
                    </div>
                  </motion.div>
                )}

                <button 
                  type="submit"
                  className="w-full bg-violet-600 text-white py-5 rounded-2xl font-black text-xl shadow-xl shadow-violet-100 hover:bg-violet-700 active:scale-95 transition-all mt-4"
                >
                  {editingExpense ? 'Update Expense' : 'Save Expense'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bottom Nav (Android Style) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-slate-100 px-8 py-4 flex justify-around items-center z-40">
        <button 
          onClick={() => setActiveTab('list')}
          className={cn(
            "flex flex-col items-center gap-1 transition-all",
            activeTab === 'list' ? "text-violet-600 scale-110" : "text-slate-400"
          )}
        >
          <Home size={26} />
          <span className="text-[10px] font-black uppercase tracking-widest">Home</span>
        </button>
        
        <button 
          onClick={() => { resetForm(); setShowAddModal(true); }}
          className="w-16 h-16 bg-violet-600 text-white rounded-[24px] flex items-center justify-center shadow-2xl shadow-violet-300 -translate-y-8 border-4 border-[#f7f9fc] active:scale-90 transition-all"
        >
          <Plus size={32} />
        </button>

        <button 
          onClick={() => setActiveTab('stats')}
          className={cn(
            "flex flex-col items-center gap-1 transition-all",
            activeTab === 'stats' ? "text-violet-600 scale-110" : "text-slate-400"
          )}
        >
          <BarChart3 size={26} />
          <span className="text-[10px] font-black uppercase tracking-widest">Stats</span>
        </button>

        <button 
          onClick={() => setActiveTab('cards')}
          className={cn(
            "flex flex-col items-center gap-1 transition-all",
            activeTab === 'cards' ? "text-violet-600 scale-110" : "text-slate-400"
          )}
        >
          <CreditCardIcon size={26} />
          <span className="text-[10px] font-black uppercase tracking-widest">Cards</span>
        </button>

        <button 
          onClick={() => setActiveTab('banks')}
          className={cn(
            "flex flex-col items-center gap-1 transition-all",
            activeTab === 'banks' ? "text-violet-600 scale-110" : "text-slate-400"
          )}
        >
          <Building2 size={26} />
          <span className="text-[10px] font-black uppercase tracking-widest">Banks</span>
        </button>
      </div>
    </div>
  );
}
