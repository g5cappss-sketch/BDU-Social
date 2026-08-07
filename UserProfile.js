import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, Text, View, Image, TouchableOpacity, 
  FlatList, ActivityIndicator, StatusBar, Dimensions, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, query, where, onSnapshot, doc, deleteDoc, setDoc, getDocs, Timestamp, updateDoc, arrayUnion, arrayRemove, increment } from 'firebase/firestore';
import { auth, db } from '../../BDU_SocialApp/firebaseConfig';
import Toast from 'react-native-toast-message';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BDU_RED = '#C8102E';
const DEFAULT_AVATAR = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png';
const DEFAULT_COVER = 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80';

const formatPostTime = (timestamp) => {
  if (!timestamp) return 'Đã đăng một bài viết';
  if (typeof timestamp === 'string') return timestamp;
  
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${hours}:${minutes} - ${day}/${month}`;
  } catch (e) {
    return 'Đã đăng một bài viết';
  }
};

export default function UserProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const targetUserId = params.userId; 
  const currentUserId = auth.currentUser?.uid;

  const [profileUser, setProfileUser] = useState(null);
  const [userPosts, setUserPosts] = useState([]);
  const [friendsCount, setFriendsCount] = useState(0);
  const [isFriend, setIsFriend] = useState(false);
  const [friendRequestId, setFriendRequestId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!targetUserId || !currentUserId) return;

    // 1. LẮNG NGHE REAL-TIME TOÀN BỘ THÔNG TIN USER TỪ FIRESTORE
    const userRef = doc(db, "users", targetUserId);
    const unsubscribeUser = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setProfileUser({ 
          id: docSnap.id, 
          ...data,
          fullName: data.fullName || data.name || data.displayName || "Sinh viên BDU",
          coverPhoto: data.coverPhoto || data.coverImage || data.background || data.cover || DEFAULT_COVER,
          avatar: data.avatar || data.photoURL || DEFAULT_AVATAR,
          major: data.major || data.nganhHoc || "Công nghệ Thông tin",
          hobby: data.hobby || data.sothich || "Chưa cập nhật",
          bio: data.bio || data.tieuSu || "",
          location: data.location || data.diaChi || "Bình Dương"
        });
      }
    });

    // 2. LẮNG NGHE REAL-TIME DANH SÁCH BÀI VIẾT (Lọc bỏ bài ẩn danh)
    const qPosts = query(
      collection(db, "posts"),
      where("userId", "==", targetUserId)
    );
    const unsubscribePosts = onSnapshot(qPosts, (snapshot) => {
      const posts = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(post => !post.isAnonymous);

      setUserPosts(posts);
    });

    // 3. LẮNG NGHE SỐ LƯỢNG BẠN BÈ THỰC TẾ
    const friendsRef = collection(db, "users", targetUserId, "friends");
    const unsubscribeFriends = onSnapshot(friendsRef, (snapshot) => {
      setFriendsCount(snapshot.size);
    });

    // 4. KIỂM TRA TRẠNG THÁI QUAN HỆ
    const myFriendDocRef = doc(db, "users", currentUserId, "friends", targetUserId);
    const unsubscribeMyFriend = onSnapshot(myFriendDocRef, (docSnap) => {
      setIsFriend(docSnap.exists());
    });

    // 5. KIỂM TRA TRẠNG THÁI LỜI MỜI KẾT BẠN
    const qReq1 = query(
      collection(db, "friend_requests"),
      where("fromUserId", "==", currentUserId),
      where("toUserId", "==", targetUserId)
    );
    const unsubscribeReq1 = onSnapshot(qReq1, (snapshot) => {
      if (!snapshot.empty) {
        setFriendRequestId(snapshot.docs[0].id);
      } else {
        setFriendRequestId(null);
      }
      setLoading(false);
    });

    return () => {
      unsubscribeUser();
      unsubscribePosts();
      unsubscribeFriends();
      unsubscribeMyFriend();
      unsubscribeReq1();
    };
  }, [targetUserId, currentUserId]);

  // XỬ LÝ THẢ TIM (LIKE / UNLIKE) BÀI VIẾT
  const handleLikePost = async (postId, likedBy = []) => {
    if (!currentUserId) return;
    try {
      const postRef = doc(db, "posts", postId);
      const isLiked = likedBy.includes(currentUserId);

      if (isLiked) {
        await updateDoc(postRef, {
          likedBy: arrayRemove(currentUserId),
          likes: increment(-1)
        });
      } else {
        await updateDoc(postRef, {
          likedBy: arrayUnion(currentUserId),
          likes: increment(1)
        });
      }
    } catch (error) {
      console.log("Lỗi thích bài viết:", error);
    }
  };

  // XỬ LÝ MỞ BÌNH LUẬN
  const handleOpenComment = (item) => {
    router.push({
      pathname: '/comments', // Hoặc điều hướng tới màn hình/modal bình luận của app bạn
      params: { postId: item.id }
    });
  };

  // XỬ LÝ MỞ PHÒNG CHAT REAL-TIME
  const handleStartChat = async () => {
    if (!currentUserId || !targetUserId) return;

    try {
      const chatsRef = collection(db, "chats");
      const q = query(chatsRef, where("participants", "array-contains", currentUserId));
      const querySnapshot = await getDocs(q);
      
      let existingChatId = null;
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.participants && data.participants.includes(targetUserId)) {
          existingChatId = docSnap.id;
        }
      });

      let chatId = existingChatId;

      if (!chatId) {
        const newChatRef = doc(collection(db, "chats"));
        chatId = newChatRef.id;

        const now = Timestamp.now();
        await setDoc(newChatRef, {
          participants: [currentUserId, targetUserId],
          usersInfo: [
            {
              uid: currentUserId,
              name: auth.currentUser?.displayName || "Sinh viên BDU",
              avatar: auth.currentUser?.photoURL || DEFAULT_AVATAR
            },
            {
              uid: targetUserId,
              name: profileUser?.fullName || "Sinh viên BDU",
              avatar: profileUser?.avatar || DEFAULT_AVATAR
            }
          ],
          updatedAt: now,
          lastMessage: "Bắt đầu cuộc trò chuyện",
          lastSenderId: currentUserId
        });
      }

      router.push({ 
        pathname: '/chat', 
        params: { 
          chatId: chatId, 
          name: profileUser?.fullName || 'Sinh viên BDU'
        } 
      });

    } catch (error) {
      console.log("Lỗi mở chat:", error);
      Toast.show({ type: 'error', text1: 'Không thể mở đoạn chat, vui lòng thử lại' });
    }
  };

  // XỬ LÝ GỬI / HỦY YÊU CẦU KẾT BẠN
  const handleAddOrCancelFriend = async () => {
    if (!currentUserId || !targetUserId) return;

    try {
      if (friendRequestId) {
        await deleteDoc(doc(db, "friend_requests", friendRequestId));
        setFriendRequestId(null);
        Toast.show({ type: 'info', text1: 'Đã thu hồi lời mời kết bạn', visibilityTime: 1500 });
      } else {
        await setDoc(doc(collection(db, "friend_requests")), {
          fromUserId: currentUserId,
          toUserId: targetUserId,
          status: "pending",
          time: Timestamp.now()
        });
        Toast.show({ type: 'success', text1: 'Đã gửi lời mời kết bạn!', visibilityTime: 1500 });
      }
    } catch (error) {
      console.log("Lỗi kết bạn:", error);
      Toast.show({ type: 'error', text1: 'Thực hiện thất bại, thử lại sau' });
    }
  };

  // XỬ LÝ HỦY KẾT BẠN
  const handleUnfriend = () => {
    Alert.alert(
      "Hủy kết bạn",
      `Bạn có chắc chắn muốn hủy kết bạn với ${profileUser?.fullName} không?`,
      [
        { text: "Hủy", style: "cancel" },
        { 
          text: "Đồng ý", 
          style: "destructive", 
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "users", currentUserId, "friends", targetUserId));
              await deleteDoc(doc(db, "users", targetUserId, "friends", currentUserId));
              Toast.show({ type: 'success', text1: 'Đã hủy kết bạn thành công', visibilityTime: 1500 });
            } catch (err) {
              Toast.show({ type: 'error', text1: 'Lỗi khi hủy kết bạn' });
            }
          } 
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={BDU_RED} />
        <Text style={{ marginTop: 12, color: '#65676B', fontWeight: '500' }}>Đang đồng bộ hồ sơ...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF" translucent={false} />

      {/* HEADER TOP */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {profileUser?.fullName || "Trang cá nhân"}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <FlatList
        data={userPosts}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListHeaderComponent={
          <View>
            {/* KHỐI 1: HEADER & THÔNG TIN CƠ BẢN */}
            <View style={styles.profileHeaderCard}>
              <Image 
                source={{ uri: profileUser?.coverPhoto }} 
                style={styles.coverPhoto} 
              />

              <View style={styles.avatarSection}>
                <View style={styles.avatarWrapper}>
                  <Image 
                    source={{ uri: profileUser?.avatar }} 
                    style={styles.profileAvatar} 
                  />
                  {profileUser?.isOnline && <View style={styles.onlineBadge} />}
                </View>
                
                <Text style={styles.profileName}>
                  {profileUser?.fullName || "Sinh viên BDU"}
                  {profileUser?.role === 'admin' && (
                    <MaterialCommunityIcons name="check-decagram" size={20} color="#0084FF" style={{ marginLeft: 6 }} />
                  )}
                </Text>
                
                <Text style={styles.profileRole}>
                  {profileUser?.role === 'admin' ? 'Quản trị viên BDU Social' : 'Thành viên BDU Social'}
                </Text>

                {/* NÚT TƯƠNG TÁC */}
                {targetUserId !== currentUserId && (
                  <View style={styles.actionButtonsRow}>
                    {isFriend ? (
                      <TouchableOpacity style={styles.friendBadgeBtn} activeOpacity={0.8} onPress={handleUnfriend}>
                        <Ionicons name="checkmark-sharp" size={18} color="#34C759" style={{ marginRight: 6 }} />
                        <Text style={styles.friendBadgeText}>Bạn bè</Text>
                      </TouchableOpacity>
                    ) : friendRequestId ? (
                      <TouchableOpacity style={styles.sentRequestBtn} activeOpacity={0.8} onPress={handleAddOrCancelFriend}>
                        <Ionicons name="time-outline" size={18} color="#65676B" style={{ marginRight: 6 }} />
                        <Text style={styles.sentRequestText}>Đã gửi lời mời</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.8} onPress={handleAddOrCancelFriend}>
                        <Ionicons name="person-add" size={18} color="#FFF" style={{ marginRight: 6 }} />
                        <Text style={styles.primaryBtnText}>Kết bạn</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.8} onPress={handleStartChat}>
                      <Ionicons name="chatbubble-ellipses" size={18} color="#1A1A1A" style={{ marginRight: 6 }} />
                      <Text style={styles.secondaryBtnText}>Nhắn tin</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* THỐNG KÊ */}
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{friendsCount}</Text>
                  <Text style={styles.statLabel}>Bạn bè</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{userPosts.length}</Text>
                  <Text style={styles.statLabel}>Bài viết</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>{profileUser?.followersCount || 0}</Text>
                  <Text style={styles.statLabel}>Người theo dõi</Text>
                </View>
              </View>
            </View>

            {/* KHỐI 2: THẺ GIỚI THIỆU */}
            <View style={styles.infoCard}>
              <Text style={styles.sectionTitle}>Giới thiệu</Text>
              
              {profileUser?.bio ? (
                <Text style={styles.bioText}>"{profileUser.bio}"</Text>
              ) : null}

              <View style={styles.infoList}>
                <View style={styles.infoRow}>
                  <Ionicons name="school" size={20} color="#8A8D91" style={styles.infoIcon} />
                  <Text style={styles.infoText}>
                    Học <Text style={styles.infoHighlight}>{profileUser?.major}</Text> tại <Text style={styles.infoHighlight}>Đại học Bình Dương</Text>
                  </Text>
                </View>

                <View style={styles.infoRow}>
                  <Ionicons name="heart" size={20} color="#8A8D91" style={styles.infoIcon} />
                  <Text style={styles.infoText}>
                    Sở thích: <Text style={styles.infoHighlight}>{profileUser?.hobby}</Text>
                  </Text>
                </View>

                <View style={styles.infoRow}>
                  <Ionicons name="location" size={20} color="#8A8D91" style={styles.infoIcon} />
                  <Text style={styles.infoText}>
                    Sống tại <Text style={styles.infoHighlight}>{profileUser?.location}</Text>
                  </Text>
                </View>
              </View>
            </View>

            {/* KHỐI 3: TIÊU ĐỀ BÀI VIẾT */}
            <View style={styles.postsHeaderTitle}>
              <Text style={styles.sectionTitle}>Bài viết đã đăng</Text>
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const isLikedByMe = item.likedBy?.includes(currentUserId);
          return (
            <View style={styles.postCard}>
              {/* Header bài viết */}
              <View style={styles.postHeader}>
                <Image source={{ uri: profileUser?.avatar }} style={styles.postAvatar} />
                <View style={styles.postInfo}>
                  <Text style={styles.postAuthor} numberOfLines={1}>{profileUser?.fullName}</Text>
                  <Text style={styles.postTime}>{formatPostTime(item.time)}</Text>
                </View>
              </View>

              {/* Nội dung chữ */}
              <Text style={styles.postContent}>{item.content}</Text>

              {/* Hình ảnh (nếu có) */}
              {item.image && <Image source={{ uri: item.image }} style={styles.postImage} resizeMode="cover" />}

              {/* Thống kê lượt thích & bình luận */}
              <View style={styles.postStats}>
                <View style={styles.statsLeft}>
                  <View style={styles.likeIconBg}>
                    <Ionicons name="heart" size={12} color="#FFF" />
                  </View>
                  <Text style={styles.statsText}>{item.likedBy?.length || item.likes || 0}</Text>
                </View>
                <Text style={styles.statsText}>{item.comments || 0} bình luận</Text>
              </View>

              <View style={styles.postDivider} />

              {/* Nút Tương tác: Thả tim & Bình luận */}
              <View style={styles.postActions}>
                <TouchableOpacity 
                  style={styles.actionBtn} 
                  activeOpacity={0.7} 
                  onPress={() => handleLikePost(item.id, item.likedBy)}
                >
                  <Ionicons 
                    name={isLikedByMe ? "heart" : "heart-outline"} 
                    size={20} 
                    color={isLikedByMe ? BDU_RED : "#4B4C4F"} 
                  />
                  <Text style={[styles.actionText, isLikedByMe && { color: BDU_RED, fontWeight: '750' }]}>
                    {isLikedByMe ? "Đã thích" : "Thích"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.actionBtn} 
                  activeOpacity={0.7} 
                  onPress={() => handleOpenComment(item)}
                >
                  <Ionicons name="chatbubble-outline" size={20} color="#4B4C4F" />
                  <Text style={styles.actionText}>Bình luận</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyPosts}>
            <View style={styles.emptyIconBg}>
              <Ionicons name="newspaper-outline" size={40} color="#A0A3A7" />
            </View>
            <Text style={styles.emptyTextTitle}>Chưa có bài viết công khai</Text>
            <Text style={styles.emptyTextSub}>Thành viên này chưa chia sẻ bài viết công khai nào (các bài viết ẩn danh sẽ được bảo mật).</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F2F5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF' },
  
  header: { height: 60, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 8, elevation: 2, zIndex: 10 },
  backBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A', flex: 1, textAlign: 'center' },

  profileHeaderCard: { backgroundColor: '#FFF', paddingBottom: 16, borderBottomLeftRadius: 16, borderBottomRightRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  coverPhoto: { height: 180, width: '100%', backgroundColor: '#E1E4EB' },
  
  avatarSection: { alignItems: 'center', marginTop: -60, paddingHorizontal: 20 },
  avatarWrapper: { position: 'relative', borderRadius: 60, backgroundColor: '#FFF', padding: 4, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 6 },
  profileAvatar: { width: 110, height: 110, borderRadius: 55, backgroundColor: '#F0F2F5' },
  onlineBadge: { position: 'absolute', bottom: 8, right: 8, width: 22, height: 22, borderRadius: 11, backgroundColor: '#31A24C', borderWidth: 3, borderColor: '#FFF' },
  
  profileName: { fontSize: 24, fontWeight: '800', color: '#1A1A1A', marginTop: 10, flexDirection: 'row', alignItems: 'center' },
  profileRole: { fontSize: 14, color: '#65676B', marginTop: 4, fontWeight: '500', marginBottom: 20 },

  actionButtonsRow: { flexDirection: 'row', width: '100%', gap: 10 },
  primaryBtn: { flex: 1, flexDirection: 'row', backgroundColor: BDU_RED, paddingVertical: 12, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  primaryBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  
  friendBadgeBtn: { flex: 1, flexDirection: 'row', backgroundColor: '#E8F8EE', borderWidth: 1, borderColor: '#34C759', paddingVertical: 12, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  friendBadgeText: { color: '#28A745', fontSize: 15, fontWeight: '700' },

  sentRequestBtn: { flex: 1, flexDirection: 'row', backgroundColor: '#E4E6EB', paddingVertical: 12, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  sentRequestText: { color: '#65676B', fontSize: 15, fontWeight: '700' },

  secondaryBtn: { flex: 1, flexDirection: 'row', backgroundColor: '#E4E6EB', paddingVertical: 12, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  secondaryBtnText: { color: '#1A1A1A', fontSize: 15, fontWeight: '700' },

  statsRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#F0F2F5', marginTop: 24, paddingTop: 16, paddingHorizontal: 20 },
  statItem: { flex: 1, alignItems: 'center' },
  statNumber: { fontSize: 18, fontWeight: '800', color: '#1A1A1A' },
  statLabel: { fontSize: 13, color: '#65676B', marginTop: 4, fontWeight: '500' },
  statDivider: { width: 1, backgroundColor: '#E4E6EB', height: '70%', alignSelf: 'center' },

  infoCard: { backgroundColor: '#FFF', margin: 12, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1A1A1A', marginBottom: 12 },
  bioText: { fontSize: 15, color: '#4B4C4F', fontStyle: 'italic', textAlign: 'center', marginBottom: 16, lineHeight: 22 },
  infoList: { gap: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center' },
  infoIcon: { width: 28, textAlign: 'center', marginRight: 8 },
  infoText: { fontSize: 15, color: '#1A1A1A', flex: 1, lineHeight: 22 },
  infoHighlight: { fontWeight: '700', color: '#1A1A1A' },

  postsHeaderTitle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  
  // Style chuẩn cho thẻ bài viết cá nhân
  postCard: { backgroundColor: '#FFF', marginHorizontal: 12, marginBottom: 12, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E4E6EB', elevation: 1 },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  postAvatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 0.5, borderColor: '#E4E6EB' },
  postInfo: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  postAuthor: { fontSize: 15, fontWeight: '700', color: '#1C1E21' },
  postTime: { fontSize: 12, color: '#8A8D91' },
  postContent: { fontSize: 15, color: '#1C1E21', lineHeight: 22, marginBottom: 12 },
  postImage: { width: '100%', height: 250, borderRadius: 12, backgroundColor: '#F0F2F5', marginBottom: 12 },

  // Style thống kê & nút tương tác
  postStats: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, paddingBottom: 10 },
  statsLeft: { flexDirection: 'row', alignItems: 'center' },
  likeIconBg: { backgroundColor: BDU_RED, width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  statsText: { color: '#65676B', fontSize: 13, marginLeft: 6, fontWeight: '500' },
  postDivider: { height: 1, backgroundColor: '#F0F2F5', marginBottom: 4 },
  postActions: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 4 },
  actionBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 6, backgroundColor: '#F9FAFB', borderRadius: 8, marginHorizontal: 4 },
  actionText: { color: '#4B4C4F', fontSize: 14, fontWeight: '600', marginLeft: 6 },

  emptyPosts: { padding: 40, alignItems: 'center', backgroundColor: '#FFF', marginHorizontal: 12, borderRadius: 16 },
  emptyIconBg: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#F0F2F5', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTextTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginBottom: 8 },
  emptyTextSub: { color: '#8A8D91', fontSize: 14, textAlign: 'center', paddingHorizontal: 20 }
});
