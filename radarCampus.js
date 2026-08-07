import React, { useEffect, useState, useRef } from 'react';
import { 
  StyleSheet, Text, View, Image, TouchableOpacity, 
  Animated, Easing, Dimensions, Modal, ActivityIndicator 
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, query, onSnapshot, doc, setDoc, getDocs, where, Timestamp } from 'firebase/firestore';
import { auth, db } from '../../BDU_SocialApp/firebaseConfig';
import { useRouter } from 'expo-router';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BDU_RED = '#C8102E';
const DEFAULT_AVATAR = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png';

export default function CampusRadarScreen({ onClose }) {
  const router = useRouter();
  const currentUserId = auth.currentUser?.uid;
  
  const [nearbyUsers, setNearbyUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Hiệu ứng sóng radar quay vòng tròn
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Chạy animation vòng quét radar liên tục
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 4000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Lấy danh sách user từ Firebase để hiển thị lên radar
    const q = query(collection(db, "users"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        // Loại bỏ chính tài khoản đang đăng nhập ra khỏi radar
        .filter(u => u.id !== currentUserId);

      // Tạo vị trí ngẫu nhiên giả lập quanh tâm radar cho sinh động
      const usersWithCoords = users.map((user, index) => {
        // Phân bổ đều các điểm theo góc vòng tròn
        const angle = (index * (360 / Math.max(users.length, 1))) * (Math.PI / 180);
        const distance = 60 + (index * 25) % 110; // Khoảng cách từ tâm ra ngoài
        return {
          ...user,
          left: SCREEN_WIDTH / 2 + distance * Math.cos(angle) - 24,
          top: 200 + distance * Math.sin(angle) - 24,
          // 🔴 SỬA TẠI ĐÂY: Lấy đúng sở thích thực tế của user, nếu không có thì hiển thị chuyên ngành hoặc để "Chưa cập nhật"
          hobby: user.hobby || user.major || "Thành viên BDU Social"
        };
      });

      setNearbyUsers(usersWithCoords);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'] // Bắt buộc phải là 0deg đến 360deg
  });

  const handleStartChat = async (user) => {
    setSelectedUser(null);
    if (!currentUserId || !user?.id) return;

    try {
      // 1. Kiểm tra xem đã có phòng chat 1-1 giữa 2 người này chưa
      const chatsRef = collection(db, "chats");
      const q = query(chatsRef, where("participants", "array-contains", currentUserId));
      const querySnapshot = await getDocs(q);
      
      let existingChatId = null;
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.participants && data.participants.includes(user.id)) {
          existingChatId = docSnap.id;
        }
      });

      let chatId = existingChatId;

      // 2. Nếu chưa có, tiến hành tạo mới một phòng chat trên Firebase
      if (!chatId) {
        const newChatRef = doc(collection(db, "chats"));
        chatId = newChatRef.id;

        const now = Timestamp.now();
        await setDoc(newChatRef, {
          participants: [currentUserId, user.id],
          usersInfo: [
            {
              uid: currentUserId,
              name: auth.currentUser?.displayName || "Sinh viên BDU",
              avatar: auth.currentUser?.photoURL || DEFAULT_AVATAR
            },
            {
              uid: user.id,
              name: user.fullName || user.name || "Sinh viên BDU",
              avatar: user.avatar || DEFAULT_AVATAR
            }
          ],
          updatedAt: now,
          lastMessage: "Bắt đầu cuộc trò chuyện làm quen",
          lastSenderId: currentUserId
        });
      }

      // 3. Mở phòng chat với chatId chuẩn xác
      router.push({ 
        pathname: '/chat', 
        params: { 
          name: user.fullName || user.name || 'Sinh viên BDU', 
          chatId: chatId 
        } 
      });

    } catch (error) {
      console.log("Lỗi tạo/mở phòng chat từ radar:", error);
    }
  };

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Campus Radar BDU</Text>
        <View style={{ width: 40 }} />
      </View>

      <Text style={styles.subTitle}>Đang quét sinh viên trực tuyến quanh khu vực trường...</Text>

      {/* KHU VỰC MÀN HÌNH RADAR */}
      <View style={styles.radarContainer}>
        {/* Các vòng tròn đồng tâm radar */}
        <View style={[styles.radarRing, { width: 120, height: 120, borderRadius: 60 }]} />
        <View style={[styles.radarRing, { width: 220, height: 220, borderRadius: 110 }]} />
        <View style={[styles.radarRing, { width: 320, height: 320, borderRadius: 160 }]} />
        
        {/* Tia quét radar quay */}
        <Animated.View style={[styles.radarBeamWrapper, { transform: [{ rotate: spin }] }]}>
          <View style={styles.radarBeam} />
        </Animated.View>

        {/* Tâm Radar (Chính là bạn) */}
        <View style={styles.centerUserDot}>
          <View style={styles.centerPulse} />
          <Ionicons name="person" size={16} color="#FFF" />
        </View>

        {/* Các chấm sinh viên xung quanh trên radar */}
        {loading ? (
          <ActivityIndicator size="small" color={BDU_RED} style={{ marginTop: 150 }} />
        ) : (
          nearbyUsers.map((user, idx) => (
            <TouchableOpacity 
              key={user.id || idx} 
              style={[styles.userDot, { left: user.left, top: user.top }]}
              activeOpacity={0.8}
              onPress={() => setSelectedUser(user)}
            >
              <Image 
                source={{ uri: user.avatar?.trim() ? user.avatar : DEFAULT_AVATAR }} 
                style={styles.dotAvatar} 
              />
              <View style={styles.onlineDotMini} />
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* CHÚ THÍCH DƯỚI ĐÁY */}
      <View style={styles.footerInfo}>
        <MaterialCommunityIcons name="radar" size={20} color={BDU_RED} />
        <Text style={styles.footerText}> Tìm thấy <Text style={{fontWeight: 'bold', color: BDU_RED}}>{nearbyUsers.length}</Text> sinh viên đang online quanh bạn</Text>
      </View>

      {/* MODAL THÔNG TIN KHI BẤM VÀO MỘT CHẤM TRÊN RADAR */}
      {selectedUser && (
        <View style={styles.popupCard}>
          <TouchableOpacity style={styles.popupClose} onPress={() => setSelectedUser(null)}>
            <Ionicons name="close-circle" size={22} color="#8A8D91" />
          </TouchableOpacity>

          <View style={styles.popupHeader}>
            <Image 
              source={{ uri: selectedUser.avatar?.trim() ? selectedUser.avatar : DEFAULT_AVATAR }} 
              style={styles.popupAvatar} 
            />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.popupName}>{selectedUser.fullName || selectedUser.name || "Sinh viên BDU"}</Text>
              <Text style={styles.popupMajor}>{selectedUser.major || "Công nghệ Thông tin"}</Text>
              <View style={styles.hobbyBadge}>
                <Text style={styles.hobbyText}>{selectedUser.hobby}</Text>
              </View>
            </View>
          </View>

          <View style={styles.popupActions}>
            <TouchableOpacity 
              style={styles.actionChatBtn} 
              activeOpacity={0.8}
              onPress={() => handleStartChat(selectedUser)}
            >
              <Ionicons name="chatbubbles-outline" size={18} color="#FFF" style={{ marginRight: 6 }} />
              <Text style={styles.actionChatText}>Nhắn tin làm quen</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={styles.actionProfileBtn} 
            activeOpacity={0.8}
            onPress={() => {
              setSelectedUser(null); // Đóng popup radar lại
              if (selectedUser.id === currentUserId) {
                router.push('/profile'); // Nếu là chính mình thì về tab profile cá nhân
              } else {
                router.push({
                  pathname: '/UserProfileScreen', 
                  params: { userId: selectedUser.id } 
                });
              }
            }}
          >
            <Text style={styles.actionProfileText}>Xem trang cá nhân</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F19' }, 
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 10 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 },
  subTitle: { fontSize: 13, color: '#8A8D91', textAlign: 'center', marginBottom: 20 },

  radarContainer: { width: SCREEN_WIDTH, height: 380, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  radarRing: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(200, 16, 46, 0.25)', backgroundColor: 'rgba(200, 16, 46, 0.02)' },
  
  radarBeamWrapper: { 
    position: 'absolute', 
    width: 320, 
    height: 320, 
    justifyContent: 'center', 
    alignItems: 'center',
  },
  radarBeam: { 
    position: 'absolute',
    top: 0,
    left: '50%', 
    width: 160, 
    height: 160, 
    backgroundColor: 'rgba(200, 16, 46, 0.25)', 
    borderTopRightRadius: 160, 
  },

  centerUserDot: { width: 36, height: 36, borderRadius: 18, backgroundColor: BDU_RED, justifyContent: 'center', alignItems: 'center', zIndex: 10, borderWidth: 2, borderColor: '#FFF' },
  centerPulse: { position: 'absolute', width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(200, 16, 46, 0.3)' },

  userDot: { position: 'absolute', width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', zIndex: 5 },
  dotAvatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: BDU_RED, backgroundColor: '#222' },
  onlineDotMini: { position: 'absolute', bottom: 2, right: 2, width: 10, height: 10, borderRadius: 5, backgroundColor: '#34C759', borderWidth: 1.5, borderColor: '#FFF' },

  footerInfo: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 20, backgroundColor: 'rgba(255,255,255,0.05)', marginHorizontal: 40, paddingVertical: 12, borderRadius: 20 },
  footerText: { color: '#E4E6EB', fontSize: 13, marginLeft: 8, fontWeight: '500' },

  popupCard: { position: 'absolute', bottom: 40, left: 20, right: 20, backgroundColor: '#1E222B', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  popupClose: { position: 'absolute', top: 10, right: 10, zIndex: 5 },
  popupHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  popupAvatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: BDU_RED },
  popupName: { fontSize: 16, fontWeight: '700', color: '#FFF', marginBottom: 2 },
  popupMajor: { fontSize: 12, color: '#9CA3AF', marginBottom: 6 },
  hobbyBadge: { backgroundColor: 'rgba(200, 16, 46, 0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start' },
  hobbyText: { color: '#FF8A8A', fontSize: 11, fontWeight: '600' },
  
  actionChatBtn: { flexDirection: 'row', backgroundColor: BDU_RED, paddingVertical: 12, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  actionChatText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  
  actionProfileBtn: { marginTop: 10, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)' },
  actionProfileText: { color: '#E4E6EB', fontSize: 13, fontWeight: '600' }
});
