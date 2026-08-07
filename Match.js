import React, { useState, useRef, useEffect } from 'react';
import { 
  StyleSheet, Text, View, Image, 
  TouchableOpacity, StatusBar, Platform,
  Animated, Modal, FlatList, ActivityIndicator,
  Dimensions
} from 'react-native';
import { Ionicons, FontAwesome5, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// FIREBASE IMPORTS
import { collection, getDocs, addDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../BDU_SocialApp/firebaseConfig';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BDU_RED = '#C8102E';
const BDU_BG = '#F8F9FA';
const DEFAULT_AVATAR = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png';

const MAJORS = [
  'Tất cả', 'Ngôn ngữ Anh', 'Xã hội học', 'Nhật Bản học', 'Hàn Quốc học',
  'Quản trị Kinh doanh', 'Tài chính - Ngân hàng', 'Kế toán', 'Luật', 'Luật Kinh tế',
  'Công nghệ Thông tin', 'Công nghệ Kỹ thuật Công trình Xây dựng', 'Công nghệ Kỹ thuật Ô tô',
  'Công nghệ Kỹ thuật Điện, Điện tử', 'Logistics và Quản lý Chuỗi Cung ứng',
  'Công nghệ Thực phẩm', 'Kiến trúc', 'Dược học', 'Hoá dược'
];

const DEMO_PROFILE = {
  id: 'demo_profile_id',
  name: 'Nguyễn Văn Demo',
  major: 'Công nghệ Thông tin',
  avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=800&q=80',
  bio: 'Xin chào! Đây là hồ sơ demo để kiểm tra giao diện hệ thống Match tại BDU.',
  tags: ['#DemoUser', '#BDU_Student', '#TestUI']
};

export default function MatchScreen() {
  const insets = useSafeAreaInsets();
  const currentUserId = auth.currentUser?.uid;

  const [allStudents, setAllStudents] = useState([]); 
  const [students, setStudents] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const [countdown, setCountdown] = useState(3);
  const [isFilteringTimer, setIsFilteringTimer] = useState(false);

  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [selectedMajor, setSelectedMajor] = useState('Tất cả');

  const cardSelectAnim = useRef(new Animated.Value(0)).current; 
  const cardFadeAnim = useRef(new Animated.Value(1)).current;   
  const nextCardOpacity = useRef(new Animated.Value(0.6)).current; 
  const nextCardScale = useRef(new Animated.Value(0.96)).current;
  
  const listFadeAnim = useRef(new Animated.Value(1)).current;
  const toastAnim = useRef(new Animated.Value(-150)).current;
  const [toastConfig, setToastConfig] = useState({ title: '', desc: '', type: 'success' });

  const showToast = (title, desc, type = 'success') => {
    setToastConfig({ title, desc, type });
    Animated.spring(toastAnim, { toValue: insets.top + 12, useNativeDriver: true, friction: 6 }).start();
    setTimeout(() => {
      Animated.timing(toastAnim, { toValue: -150, duration: 300, useNativeDriver: true }).start();
    }, 2200);
  };

  const fetchUsers = async () => {
    setLoading(true);
    setIsFilteringTimer(true);
    setCountdown(3);

    try {
      const sentQuery = query(collection(db, "friend_requests"), where("fromUserId", "==", currentUserId));
      const receivedQuery = query(collection(db, "friend_requests"), where("toUserId", "==", currentUserId));
      const friendsSnap = await getDocs(collection(db, "users", currentUserId, "friends"));

      const [sentSnap, receivedSnap] = await Promise.all([
        getDocs(sentQuery),
        getDocs(receivedQuery)
      ]);

      const excludedIds = new Set();
      friendsSnap.forEach((friendDoc) => { excludedIds.add(friendDoc.id); });

      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const processDocs = (docItem) => {
        const data = docItem.data();
        const otherUserId = data.fromUserId === currentUserId ? data.toUserId : data.fromUserId;
        if (data.status === 'accepted' || data.status === 'pending') {
          excludedIds.add(otherUserId);
        } else if (data.fromUserId === currentUserId && (data.status === 'skipped' || data.status === 'rejected')) {
          let reqDate = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || 0);
          if (reqDate > yesterday) excludedIds.add(otherUserId);
        }
      };

      sentSnap.forEach(processDocs);
      receivedSnap.forEach(processDocs);

      const snapshot = await getDocs(collection(db, 'users'));
      const realUsers = [DEMO_PROFILE];

      snapshot.forEach(docItem => {
        const data = docItem.data();
        if (docItem.id !== currentUserId && !excludedIds.has(docItem.id)) {
          realUsers.push({
            id: docItem.id,
            name: data.name || data.fullName || 'Sinh viên BDU',
            major: data.major || data.nganhHoc || 'Chưa cập nhật ngành',
            avatar: data.avatar?.trim() ? data.avatar : DEFAULT_AVATAR,
            bio: data.bio || data.tieuSu || 'Xin chào! Mình muốn kết bạn học tập tại BDU.',
            tags: data.tags || ['#BDU_Student']
          });
        }
      });
      
      const shuffled = realUsers.sort(() => 0.5 - Math.random());
      setAllStudents(shuffled);
      
      // Giữ nguyên trạng thái lọc theo chuyên ngành hiện tại
      if (selectedMajor === 'Tất cả') {
        setStudents(shuffled);
      } else {
        setStudents(shuffled.filter(s => s.major?.trim().toLowerCase() === selectedMajor.trim().toLowerCase()));
      }

      setCurrentIndex(0);
      resetAnimations();
    } catch (error) {
      showToast("Lỗi dữ liệu", "Không thể làm mới danh sách.", "error");
    } finally {
      setTimeout(() => {
        setLoading(false);
        setIsFilteringTimer(false);
      }, 3000);
    }
  };

  useEffect(() => {
    let timer;
    if (isFilteringTimer && countdown > 0) {
      timer = setInterval(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isFilteringTimer, countdown]);

  useEffect(() => { fetchUsers(); }, [currentUserId]);

  const resetAnimations = () => {
    cardSelectAnim.setValue(0);
    cardFadeAnim.setValue(1);
    nextCardOpacity.setValue(0.6);
    nextCardScale.setValue(0.96);
  };

  // 🎯 THUẬT TOÁN LỌC CHUYÊN NGẠNH CHUẨN XÁC KHỚP VỚI PROFILE USER
  const selectMajorFilter = (majorName) => {
    setSelectedMajor(majorName);
    setFilterModalVisible(false);
    Animated.timing(listFadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      if (majorName === 'Tất cả') {
        setStudents(allStudents);
      } else {
        const filtered = allStudents.filter(s => s.major?.trim().toLowerCase() === majorName.trim().toLowerCase());
        setStudents(filtered);
      }
      setCurrentIndex(0);
      resetAnimations();
      Animated.timing(listFadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
  };

  const handleButtonPress = (action) => {
    const item = students[currentIndex];
    if (!item) return;

    Animated.parallel([
      Animated.timing(cardSelectAnim, { toValue: action === 'connect' ? 1 : -1, duration: 250, useNativeDriver: true }),
      Animated.timing(cardFadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(nextCardOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.timing(nextCardScale, { toValue: 1, duration: 250, useNativeDriver: true })
    ]).start(() => {
      if (item.id !== 'demo_profile_id') {
        addDoc(collection(db, 'friend_requests'), {
          fromUserId: currentUserId,
          toUserId: item.id,
          status: action === 'connect' ? 'pending' : 'skipped',
          createdAt: serverTimestamp()
        }).then(() => {
          if (action === 'connect') showToast("Đã gửi tín hiệu! ✨", `Đã gửi lời mời tới ${item.name}`, "success");
        });
      } else {
        if (action === 'connect') showToast("Đã gửi tín hiệu! ✨", `Đã gửi lời mời tới ${item.name} (Demo)`, "success");
      }

      setCurrentIndex(prev => prev + 1);
      resetAnimations();
    });
  };

  const translateX = cardSelectAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-120, 0, 120]
  });

  const rotate = cardSelectAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-8deg', '0deg', '8deg']
  });

  const renderCards = () => {
    if (currentIndex >= students.length) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}><MaterialCommunityIcons name="account-search-outline" size={44} color="#C8102E" /></View>
          <Text style={styles.emptyTitle}>Tạm thời hết lượt!</Text>
          <Text style={styles.emptyDesc}>Không tìm thấy sinh viên phù hợp với chuyên ngành này. Hãy thử chọn ngành khác nhé.</Text>
          <TouchableOpacity style={styles.refreshBtn} activeOpacity={0.8} onPress={fetchUsers}>
            <Feather name="refresh-cw" size={14} color="#FFF" style={{ marginRight: 6 }} />
            <Text style={styles.refreshBtnText}>Làm mới</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return students.map((item, i) => {
      if (i < currentIndex) return null; 
      
      if (i === currentIndex) {
        return (
          <Animated.View key={item.id} style={[styles.cardAbsolute, { zIndex: 99, opacity: cardFadeAnim, transform: [{ translateX }, { rotate }] }]}>
            <View style={styles.card}>
              <View style={styles.imageWrapper}>
                <Image source={{ uri: item.avatar }} style={styles.cardImage} />
              </View>
              
              <View style={styles.cardDetailsContainer}>
                <View style={styles.tagMajorBadge}>
                  <Text style={styles.tagMajorText} numberOfLines={1}>{item.major}</Text>
                </View>
                
                <View style={styles.nameRow}>
                  <Text style={styles.studentName} numberOfLines={1}>{item.name}</Text>
                  <MaterialCommunityIcons name="check-decagram" size={20} color="#0084FF" style={{ marginLeft: 4 }} />
                </View>
                
                <Text style={styles.studentBio} numberOfLines={2}>{item.bio}</Text>
                
                <View style={styles.tagsRow}>
                  {item.tags.slice(0, 3).map((tag, idx) => (
                    <Text key={idx} style={styles.tagText}>{tag}</Text>
                  ))}
                </View>
              </View>
            </View>
          </Animated.View>
        );
      }

      if (i === currentIndex + 1) {
        return (
          <Animated.View key={item.id} style={[styles.cardAbsolute, { zIndex: 1, opacity: nextCardOpacity, transform: [{ scale: nextCardScale }] }]}>
            <View style={styles.card}>
              <View style={styles.imageWrapper}>
                <Image source={{ uri: item.avatar }} style={styles.cardImage} />
              </View>
              <View style={styles.cardDetailsContainer}>
                <Text style={styles.studentName}>{item.name}</Text>
                <Text style={styles.studentBio} numberOfLines={1}>{item.bio}</Text>
              </View>
            </View>
          </Animated.View>
        );
      }
      return null;
    }).reverse(); 
  };

  return (
    <View style={styles.container}>

      {/* TOAST APPLICATION */}
      <Animated.View style={[styles.toastContainer, { transform: [{ translateY: toastAnim }] }]}>
        <View style={styles.toastContent}>
          <Ionicons name={toastConfig.type === 'success' ? 'checkmark-circle' : 'alert-circle'} size={20} color={BDU_RED} />
          <View style={{ marginLeft: 8, flex: 1 }}>
            <Text style={styles.toastTitle}>{toastConfig.title}</Text>
            <Text style={styles.toastDesc}>{toastConfig.desc}</Text>
          </View>
        </View>
      </Animated.View>

      {/* HEADER TONE ĐỎ TRẮNG */}
      <View style={styles.appHeaderFlat}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.logoFlat}>Kết nối Sinh Viên</Text>
          <Text style={styles.headerSubFlat}>Cộng đồng sinh viên BDU {selectedMajor !== 'Tất cả' ? `• ${selectedMajor}` : ''}</Text>
        </View>

        <TouchableOpacity 
          style={[styles.filterActionBtn, selectedMajor !== 'Tất cả' && { backgroundColor: BDU_RED, borderColor: BDU_RED }]} 
          activeOpacity={0.7} 
          onPress={() => setFilterModalVisible(true)}
        >
          <Feather name="sliders" size={18} color={selectedMajor !== 'Tất cả' ? '#FFF' : '#C8102E'} />
        </TouchableOpacity>
      </View>
      
      {/* CARDS CONTAINER HOẶC MÀN HÌNH ĐẾM NGƯỢC LỌC HỒ SƠ */}
      <Animated.View style={[styles.deckContainer, { opacity: listFadeAnim }]}>
        {loading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color={BDU_RED} />
            <Text style={styles.loadingTimerText}>
              {isFilteringTimer && countdown > 0 
                ? `Hệ thống đang quét và lọc hồ sơ tương thích trong (${countdown}s)...` 
                : "Đang tải dữ liệu..."}
            </Text>
          </View>
        ) : renderCards()}
      </Animated.View>

      {/* BỘ NÚT ĐỎ - TRẮNG ĐỒNG BỘ THƯƠNG HIỆU */}
      {!loading && currentIndex < students.length && (
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity activeOpacity={0.8} onPress={() => handleButtonPress('skip')} style={styles.btnShadow}>
            <View style={[styles.roundActionBtn, styles.btnSkipRedWhite]}>
              <Feather name="x" size={26} color={BDU_RED} />
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity activeOpacity={0.8} onPress={() => handleButtonPress('connect')} style={styles.btnShadow}>
            <View style={[styles.roundActionBtn, styles.btnConnectRedWhite]}>
              <FontAwesome5 name="heart" size={22} color="#FFF" />
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* BOTTOM SHEET MODAL (ĐÃ KHẮC PHỤC NỀN ĐEN THÀNH TRONG SUỐT THANH LỊCH) */}
      <Modal visible={filterModalVisible} animationType="slide" transparent={true} onRequestClose={() => setFilterModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setFilterModalVisible(false)} />
          <View style={styles.bottomSheetWrapper}>
            <View style={styles.sheetHandleBar} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetHeaderTitle}>Chọn chuyên ngành lọc</Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}><Ionicons name="close" size={20} color="#1A1A1A" /></TouchableOpacity>
            </View>
            <FlatList
              data={MAJORS}
              keyExtractor={(item) => item}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30 }}
              renderItem={({ item }) => {
                const isActive = selectedMajor === item;
                return (
                  <TouchableOpacity style={[styles.majorRowItem, isActive && { backgroundColor: '#FFF0F2' }]} onPress={() => selectMajorFilter(item)}>
                    <Text style={[styles.majorRowText, isActive && { color: BDU_RED, fontWeight: '700' }]}>{item}</Text>
                    {isActive && <Ionicons name="checkmark" size={18} color={BDU_RED} />}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BDU_BG, overflow: 'hidden' },
  centerLoading: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  loadingTimerText: { marginTop: 12, fontSize: 13, color: '#65676B', fontWeight: '600', textAlign: 'center' },
  toastContainer: { position: 'absolute', top: 0, left: 16, right: 16, zIndex: 9999 },
  toastContent: { flexDirection: 'row', backgroundColor: '#FFF', padding: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#F5C2C2', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  toastTitle: { fontWeight: '700', fontSize: 13, color: '#1A1A1A' },
  toastDesc: { fontSize: 12, color: '#65676B' },

  appHeaderFlat: { height: 60, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#EAEAEA' },
  logoFlat: { fontSize: 18, fontWeight: '800', color: BDU_RED, letterSpacing: -0.5 },
  headerSubFlat: { fontSize: 11, color: '#65676B', marginTop: 1 },
  filterActionBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FFF5F5', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#FAD2D2' },

  deckContainer: { flex: 1, marginTop: 10, marginBottom: 10 },
  cardAbsolute: { position: 'absolute', top: 0, bottom: 0, left: 16, right: 16 },
  
  card: { flex: 1, backgroundColor: '#FFF', borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#EAEAEA', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 4 },
  imageWrapper: { flex: 0.62, backgroundColor: '#E4E6EB' },
  cardImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  
  cardDetailsContainer: { flex: 0.38, padding: 16, backgroundColor: '#FFF', justifyContent: 'space-between' },
  tagMajorBadge: { backgroundColor: '#FFF0F2', borderWidth: 1, borderColor: '#FCD4D4', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, alignSelf: 'flex-start' },
  tagMajorText: { fontSize: 11, fontWeight: '700', color: BDU_RED },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  studentName: { fontSize: 20, fontWeight: '700', color: '#1A1A1A' },
  studentBio: { fontSize: 13, color: '#4A4A4A', lineHeight: 18, marginVertical: 4 },
  tagsRow: { flexDirection: 'row', gap: 6 },
  tagText: { fontSize: 11, color: '#65676B', backgroundColor: '#F0F2F5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, fontWeight: '500' },

  actionButtonsRow: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 16 },
  btnShadow: { shadowColor: BDU_RED, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 3 },
  roundActionBtn: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
  btnSkipRedWhite: { backgroundColor: '#FFF', borderWidth: 2, borderColor: BDU_RED },
  btnConnectRedWhite: { backgroundColor: BDU_RED },

  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyIconContainer: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#FFF0F2', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  emptyDesc: { fontSize: 13, color: '#65676B', textAlign: 'center', marginTop: 4, marginBottom: 16 },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: BDU_RED, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  refreshBtnText: { color: '#FFF', fontWeight: '600', fontSize: 13 },

  // 🌟 NỀN MODAL ĐÃ ĐƯỢC CHỈNH THÀNH MỜ TRONG SUỐT (RGBA) THAY CHO NỀN ĐEN ĐẶC
  modalOverlay: { flex: 1, backgroundColor: 'rgba(255, 255, 255, 0)', justifyContent: 'flex-end' },
  bottomSheetWrapper: { backgroundColor: '#FFF', height: '60%', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  sheetHandleBar: { width: 40, height: 4, backgroundColor: '#E4E6EB', borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F2F2F2' },
  sheetHeaderTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  majorRowItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#F9F9F9' },
  majorRowText: { fontSize: 13.5, color: '#4A4A4A', flex: 1 }
});
