import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { db } from '../../BDU_SocialApp/firebaseConfig'; 
import { collection, query, where, onSnapshot, doc, getDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth'; 
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const BDU_RED = '#C8102E'; // Đã đồng bộ màu đỏ chuẩn BDU
const BDU_BG = '#F8F9FA'; // Đã đồng bộ màu nền background chuẩn
const DEFAULT_AVATAR = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png';

export default function FriendsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    const auth = getAuth();
    let unsubscribeSnapshot = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setLoading(false);
        setRequests([]);
        return;
      }

      const q = query(
        collection(db, "friend_requests"),
        where("toUserId", "==", user.uid),
        where("status", "==", "pending")
      );

      unsubscribeSnapshot = onSnapshot(q, async (snapshot) => {
        try {
          const fetchPromises = snapshot.docs.map(async (requestDoc) => {
            const data = requestDoc.data();
            const userRef = doc(db, "users", data.fromUserId);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
              const userData = userSnap.data();
              return {
                id: requestDoc.id, 
                senderId: data.fromUserId,
                fullName: userData.fullName || userData.name || "Người dùng BDU",
                avatar: userData.avatar?.trim() ? userData.avatar : DEFAULT_AVATAR,
              };
            }
            return null;
          });

          const requestsData = (await Promise.all(fetchPromises)).filter(Boolean);
          setRequests(requestsData);
        } catch (error) {
          console.log("Lỗi lấy dữ liệu lời mời:", error);
        } finally {
          setLoading(false);
        }
      });
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

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

  const renderItem = ({ item }) => {
    const isProcessing = processingId === item.id;

    return (
      <View style={styles.requestCard}>
        <Image source={{ uri: item.avatar }} style={styles.avatar} />
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{item.fullName}</Text>
          <Text style={styles.timeText}>Muốn kết nối với bạn</Text>
          
          <View style={styles.actions}>
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
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* HEADER TONE FLAT ĐỒNG BỘ */}
      <View style={styles.appHeaderFlat}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity 
            activeOpacity={0.7} 
            onPress={() => router.back()} 
            style={styles.backBtn}
          >
            <Ionicons name="chevron-back" size={28} color="#1A1A1A" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Lời mời kết bạn</Text>
          
          {requests.length > 0 && (
            <View style={styles.badgeCount}>
              <Text style={styles.badgeText}>{requests.length}</Text>
            </View>
          )}
        </View>
      </View>
      
      {/* CONTENT */}
      {loading ? (
        <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color={BDU_RED} />
            <Text style={{ marginTop: 12, color: '#65676B', fontWeight: '500', fontSize: 13 }}>Đang tải lời mời...</Text>
        </View>
      ) : requests.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Feather name="user-check" size={32} color={BDU_RED} />
          </View>
          <Text style={styles.emptyTitle}>Hộp thư trống trải</Text>
          <Text style={styles.emptyDesc}>Khi có ai đó gửi lời mời, chúng sẽ xuất hiện ở đây.</Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingVertical: 12 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' }, 
  centerLoading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  // ĐỒNG BỘ HEADER
  appHeaderFlat: { 
    height: 60, 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FFF', 
    borderBottomWidth: 1, 
    borderBottomColor: '#EAEAEA',
    paddingHorizontal: 12,
  },
  backBtn: { padding: 8, marginRight: 4, borderRadius: 20 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1A1A1A', letterSpacing: -0.5 },
  badgeCount: { backgroundColor: BDU_RED, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, marginLeft: 8 },
  badgeText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  
  // ĐỒNG BỘ THẺ CARD (Y hệt border & shadow của MatchScreen)
  requestCard: { 
    flexDirection: 'row', 
    padding: 16, 
    marginHorizontal: 16, 
    marginBottom: 12, 
    backgroundColor: '#FFF', 
    borderRadius: 16, 
    borderWidth: 1, 
    borderColor: '#EAEAEA',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 4, 
  },
  avatar: { width: 68, height: 68, borderRadius: 34, marginRight: 14, backgroundColor: '#E4E6EB' },
  info: { flex: 1, justifyContent: 'center' },
  
  // ĐỒNG BỘ FONT CHỮ
  name: { fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginBottom: 2 },
  timeText: { fontSize: 13, color: '#65676B', fontWeight: '500', marginBottom: 12 }, 
  
  // ĐỒNG BỘ BUTTONS
  actions: { flexDirection: 'row', gap: 10 },
  acceptBtn: { flex: 1, backgroundColor: BDU_RED, paddingVertical: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  acceptText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  rejectBtn: { flex: 1, backgroundColor: '#F0F2F5', paddingVertical: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rejectText: { color: '#1A1A1A', fontWeight: '700', fontSize: 13 },
  processingWrap: { flex: 1, height: 38, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F2F5', borderRadius: 8 },

  // ĐỒNG BỘ EMPTY STATE (Y hệt màn Match)
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, paddingBottom: 60 },
  emptyIconContainer: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#FFF0F2', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  emptyDesc: { fontSize: 13, color: '#65676B', textAlign: 'center', marginTop: 4, marginBottom: 16, lineHeight: 20 }
});
