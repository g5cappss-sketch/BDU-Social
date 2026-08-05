import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  ActivityIndicator, StatusBar, LayoutAnimation, Platform, UIManager
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { db } from '../../BDU_SocialApp/firebaseConfig';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Bật LayoutAnimation cho Android để hiệu ứng thu/mở mượt mà
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const BDU_RED = '#FF3B30';
const BDU_BG = '#F0F2F5';

const getTimeAgo = (timestamp) => {
  if (!timestamp) return '';
  const now = new Date();
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const seconds = Math.floor((now - date) / 1000);
  
  if (seconds < 60) return 'Vừa xong';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;
  
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
};

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isPolicyExpanded, setIsPolicyExpanded] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const qNotif = query(
      collection(db, "notifications"), 
      where("toUserId", "==", currentUser.uid), 
      orderBy("time", "desc")
    );

    const unsubNotif = onSnapshot(qNotif, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setNotifications(notifs);
      setLoading(false);
    });

    return () => unsubNotif();
  }, []);

  const handleNotificationPress = async (item) => {
    if (!item.read) {
      try {
        await updateDoc(doc(db, "notifications", item.id), { read: true });
      } catch (error) {
        console.log("Lỗi đánh dấu đã đọc:", error);
      }
    }
    if (item.type === 'friend_request') router.push('/friends'); 
  };

  const togglePolicy = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsPolicyExpanded(!isPolicyExpanded);
  };

  // THẺ CHÍNH SÁCH GHIM LÊN ĐẦU
  const renderPolicyCard = () => (
    <TouchableOpacity 
      activeOpacity={0.8} 
      style={styles.policyCard}
      onPress={togglePolicy}
    >
      <View style={styles.policyHeader}>
        <View style={styles.policyIconBg}>
          <Ionicons name="shield-checkmark" size={22} color="#FFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.policyTitle}>Chính sách & Điều khoản</Text>
          <Text style={styles.policySubTitle}>Quan trọng đối với mọi sinh viên BDU</Text>
        </View>
        <Ionicons name={isPolicyExpanded ? "chevron-up" : "chevron-down"} size={22} color="#8A8D91" />
      </View>

      {isPolicyExpanded && (
        <View style={styles.policyContent}>
          <Text style={styles.policyRule}><Text style={styles.policyHighlight}>1. Ẩn danh tuyệt đối:</Text> Hệ thống cam kết giấu kín Tên, Ảnh và MSSV khi bạn sử dụng tính năng Confession.</Text>
          <Text style={styles.policyRule}><Text style={styles.policyHighlight}>2. Cơ chế kiểm soát:</Text> Mã MSSV được lưu vết ngầm. Admin có quyền truy xuất để xử lý nếu phát hiện vi phạm pháp luật hoặc nội quy.</Text>
          <Text style={styles.policyRule}><Text style={styles.policyHighlight}>3. Nghiêm cấm:</Text> Đăng tin sai sự thật, xúc phạm, đồi trụy, bạo lực, hoặc các vấn đề nhạy cảm về chính trị/tôn giáo.</Text>
          <Text style={styles.policyRule}><Text style={styles.policyHighlight}>4. Xử lý vi phạm:</Text> Xóa bài lập tức, khóa vĩnh viễn (Ban) tài khoản, và gửi báo cáo về Phòng Công tác Sinh viên BDU.</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      activeOpacity={0.7} 
      style={[styles.notifCard, { backgroundColor: item.read ? '#FFF' : '#FFF9F9' }]}
      onPress={() => handleNotificationPress(item)}
    >
      <View style={styles.iconWrapper}>
        <Ionicons 
          name={item.type === 'friend_request' ? "person-add" : "notifications"} 
          size={22} 
          color={BDU_RED} 
        />
      </View>
      <View style={styles.textWrapper}>
        <Text style={[styles.notifText, { 
          fontWeight: item.read ? '500' : '700',
          color: item.read ? '#4A4A4A' : '#1A1A1A'
        }]}>
          {item.message || "Bạn có thông báo mới."}
        </Text>
        <Text style={[styles.timeText, { color: item.read ? '#8A8D91' : BDU_RED }]}>
          {getTimeAgo(item.time)}
        </Text>
      </View>
      {!item.read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" />
      
      {/* HEADER: Đã xóa nút Back, giữ lại tiêu đề màu đỏ căn lề chuẩn trang chủ */}
      <View style={styles.appHeaderFlat}>
        <Text style={styles.headerTitle}>Thông báo</Text>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={BDU_RED} />
          <Text style={styles.loadingText}>Đang tải thông báo...</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={item => item.id}
          ListHeaderComponent={renderPolicyCard}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Feather name="bell-off" size={32} color="#8A8D91" />
              </View>
              <Text style={styles.emptyTitle}>Chưa có thông báo cá nhân</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  
  appHeaderFlat: { 
    height: 56, 
    justifyContent: 'center', 
    backgroundColor: '#FFF', 
    paddingHorizontal: 16,
    borderBottomWidth: 1, 
    borderBottomColor: '#EAEAEA'
  },
  headerTitle: { 
    fontSize: 20, 
    fontWeight: '800', 
    color: BDU_RED, 
    letterSpacing: -0.5
  },
  
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 100 },
  loadingText: { fontSize: 13, color: '#65676B', marginTop: 12 },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, marginTop: 60 },
  emptyIconContainer: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#FFF0F2', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },

  // --- STYLE CHO THẺ CHÍNH SÁCH ---
  policyCard: {
    backgroundColor: '#F8F9FA',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EAEAEA',
    overflow: 'hidden'
  },
  policyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  policyIconBg: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#4A4A4A',
    justifyContent: 'center', alignItems: 'center', marginRight: 12
  },
  policyTitle: { fontSize: 14.5, fontWeight: '700', color: '#1A1A1A' },
  policySubTitle: { fontSize: 12, color: '#65676B', marginTop: 2 },
  policyContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#EAEAEA',
    marginTop: 4,
  },
  policyRule: { fontSize: 13, color: '#4A4A4A', lineHeight: 20, marginBottom: 8 },
  policyHighlight: { fontWeight: '700', color: '#1A1A1A' },

  notifCard: { 
    paddingHorizontal: 16,
    paddingVertical: 14, 
    borderBottomWidth: 1, 
    borderBottomColor: '#F9F9F9', 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  iconWrapper: { 
    width: 48, 
    height: 48, 
    borderRadius: 24, 
    backgroundColor: '#FFF0F2', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 14 
  },
  textWrapper: { flex: 1, justifyContent: 'center' },
  notifText: { fontSize: 13.5, lineHeight: 18 }, 
  timeText: { fontSize: 11, marginTop: 4, fontWeight: '500' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: BDU_RED, marginLeft: 10 },
});
