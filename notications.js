import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  ActivityIndicator, LayoutAnimation, Platform, UIManager, Image
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { db } from '../../BDU_SocialApp/firebaseConfig';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const BDU_RED = '#C8102E'; 
const BDU_BG = '#F8F9FA'; 
const DEFAULT_AVATAR = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png';

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
  const [friendRequests, setFriendRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isPolicyExpanded, setIsPolicyExpanded] = useState(false);
  const [processingId, setProcessingId] = useState(null);

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
      const notifs = snapshot.docs.map(doc => ({ id: doc.id, _type: 'notification', ...doc.data() }));
      setNotifications(notifs);
    });

    const qReq = query(
      collection(db, "friend_requests"),
      where("toUserId", "==", currentUser.uid),
      where("status", "==", "pending")
    );

    const unsubReq = onSnapshot(qReq, async (snapshot) => {
      try {
        const fetchPromises = snapshot.docs.map(async (requestDoc) => {
          const data = requestDoc.data();
          const userRef = doc(db, "users", data.fromUserId);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            const userData = userSnap.data();
            return {
              id: requestDoc.id, 
              _type: 'friend_request_action',
              senderId: data.fromUserId,
              fullName: userData.fullName || userData.name || "Người dùng BDU",
              avatar: userData.avatar?.trim() ? userData.avatar : DEFAULT_AVATAR,
              time: data.time || data.createdAt
            };
          }
          return null;
        });

        const requestsData = (await Promise.all(fetchPromises)).filter(Boolean);
        requestsData.sort((a, b) => (b.time?.toMillis?.() || 0) - (a.time?.toMillis?.() || 0));
        setFriendRequests(requestsData);
      } catch (error) {
        console.log("Lỗi lấy dữ liệu lời mời:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      unsubNotif();
      unsubReq();
    };
  }, []);

  const combinedData = [...friendRequests, ...notifications];

  const handleAccept = async (request) => {
    const currentUserId = getAuth().currentUser?.uid;
    if (!currentUserId) return;

    setProcessingId(request.id);
    try {
      await setDoc(doc(db, "users", currentUserId, "friends", request.senderId), {
        friendId: request.senderId,
        addedAt: new Date()
      });
      await setDoc(doc(db, "users", request.senderId, "friends", currentUserId), {
        friendId: currentUserId,
        addedAt: new Date()
      });
      await deleteDoc(doc(db, "friend_requests", request.id));
    } catch (error) {
      console.log("Lỗi chấp nhận kết bạn:", error);
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId) => {
    setProcessingId(requestId);
    try {
      await deleteDoc(doc(db, "friend_requests", requestId));
    } catch (error) {
      console.log("Lỗi từ chối kết bạn:", error);
      setProcessingId(null);
    }
  };

  const handleNotificationPress = async (item) => {
    if (!item.read) {
      try {
        await updateDoc(doc(db, "notifications", item.id), { read: true });
      } catch (error) {
        console.log("Lỗi đánh dấu đã đọc:", error);
      }
    }
  };

  const togglePolicy = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsPolicyExpanded(!isPolicyExpanded);
  };

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
        <Ionicons name={isPolicyExpanded ? "chevron-up" : "chevron-down"} size={20} color="#8A8D91" />
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

  const renderItem = ({ item }) => {
    if (item._type === 'friend_request_action') {
      const isProcessing = processingId === item.id;
      return (
        <View style={[styles.notifCard, { backgroundColor: '#FFF', borderColor: '#EAEAEA' }]}>
          <Image source={{ uri: item.avatar }} style={styles.reqAvatar} />
          <View style={styles.textWrapper}>
            <Text style={[styles.notifText, { fontWeight: '800', color: '#1A1A1A' }]} numberOfLines={2}>
              {item.fullName} <Text style={{fontWeight: '500', color: '#4A4A4A'}}>đã gửi cho bạn một lời mời kết bạn.</Text>
            </Text>
            <Text style={[styles.timeText, { color: '#8A8D91' }]}>{getTimeAgo(item.time)}</Text>
            
            <View style={styles.reqActions}>
              {isProcessing ? (
                 <View style={styles.processingWrap}>
                   <ActivityIndicator size="small" color={BDU_RED} />
                 </View>
              ) : (
                <>
                  <TouchableOpacity style={styles.acceptBtn} activeOpacity={0.8} onPress={() => handleAccept(item)}>
                    <Text style={styles.acceptText}>Xác nhận</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.rejectBtn} activeOpacity={0.8} onPress={() => handleReject(item.id)}>
                    <Text style={styles.rejectText}>Xóa</Text> 
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>
      );
    }

    return (
      <TouchableOpacity 
        activeOpacity={0.7} 
        style={[
          styles.notifCard, 
          { 
            backgroundColor: item.read ? '#FFF' : '#FFF5F5',
            borderColor: item.read ? '#EAEAEA' : '#FAD2D2' 
          }
        ]}
        onPress={() => handleNotificationPress(item)}
      >
        <View style={[styles.iconWrapper, { backgroundColor: item.read ? '#F0F2F5' : '#FFF0F2' }]}>
          <Ionicons 
            name="notifications" 
            size={22} 
            color={item.read ? '#65676B' : BDU_RED} 
          />
        </View>
        <View style={styles.textWrapper}>
          <Text style={[styles.notifText, { 
            fontWeight: item.read ? '500' : '800',
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
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={BDU_RED} />
          <Text style={{ marginTop: 12, color: '#65676B', fontWeight: '500', fontSize: 13 }}>Đang tải dữ liệu...</Text>
        </View>
      ) : (
        <FlatList
          data={combinedData}
          keyExtractor={item => item.id}
          ListHeaderComponent={renderPolicyCard}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Feather name="bell-off" size={32} color={BDU_RED} />
              </View>
              <Text style={styles.emptyTitle}>Chưa có thông báo cá nhân</Text>
              <Text style={styles.emptyDesc}>Các thông báo tương tác và lời mời kết bạn sẽ hiển thị tại đây.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BDU_BG },
  centerLoading: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  policyCard: {
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EAEAEA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden'
  },
  policyHeader: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  policyIconBg: { 
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#1A1A1A', 
    justifyContent: 'center', alignItems: 'center', marginRight: 14 
  },
  policyTitle: { fontSize: 16, fontWeight: '800', color: '#1A1A1A', marginBottom: 2 },
  policySubTitle: { fontSize: 13, color: '#65676B', fontWeight: '500' },
  policyContent: { 
    paddingHorizontal: 16, paddingBottom: 16, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#F0F2F5'
  },
  policyRule: { fontSize: 13, color: '#4A4A4A', lineHeight: 20, marginBottom: 8, fontWeight: '500' },
  policyHighlight: { fontWeight: '700', color: '#1A1A1A' },

  notifCard: { 
    flexDirection: 'row',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4,
    alignItems: 'flex-start'
  },
  iconWrapper: { 
    width: 52, height: 52, borderRadius: 26, 
    justifyContent: 'center', alignItems: 'center', marginRight: 14 
  },
  reqAvatar: { 
    width: 52, height: 52, borderRadius: 26, 
    marginRight: 14, backgroundColor: '#E4E6EB',
    borderWidth: 1, borderColor: '#F0F2F5'
  },
  textWrapper: { flex: 1, justifyContent: 'center' },
  notifText: { fontSize: 14.5, lineHeight: 22 }, 
  timeText: { fontSize: 12, marginTop: 4, fontWeight: '600' },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: BDU_RED, marginLeft: 10, marginTop: 6 },

  reqActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  acceptBtn: { flex: 1, backgroundColor: BDU_RED, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  acceptText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  rejectBtn: { flex: 1, backgroundColor: '#F0F2F5', paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  rejectText: { color: '#1A1A1A', fontWeight: '700', fontSize: 13 },
  processingWrap: { flex: 1, height: 34, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F2F5', borderRadius: 8 },

  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, marginTop: 40 },
  emptyIconContainer: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#FFF0F2', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  emptyDesc: { fontSize: 13, color: '#65676B', textAlign: 'center', marginTop: 4, marginBottom: 16, lineHeight: 20, fontWeight: '500' }
});
