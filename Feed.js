import React, { useEffect, useState, useRef } from 'react';
import { 
  StyleSheet, Text, View, FlatList, TouchableOpacity, 
  Image, ScrollView, StatusBar, Platform, Alert, ActivityIndicator, 
  RefreshControl, Modal, TextInput, Share, Animated, KeyboardAvoidingView, Keyboard,
  Dimensions, TouchableWithoutFeedback , Switch,
} from 'react-native';
// NÂNG CẤP: Import SafeAreaView từ react-native-safe-area-context
import { SafeAreaView } from 'react-native-safe-area-context'; 
import { Ionicons, FontAwesome5, Feather, MaterialCommunityIcons } from '@expo/vector-icons'; 
import { Tabs, router, useRouter } from 'expo-router'; // Đã gộp chung router và useRouter

// FIRESTORE: Đã gom đủ tất cả các hàm cần thiết (bao gồm cả arrayUnion và arrayRemove của bạn)
import { 
  collection, query, onSnapshot, addDoc, Timestamp, doc, 
  updateDoc, deleteDoc, orderBy, getDocs, getDoc, 
  arrayUnion, increment, arrayRemove, where 
} from "firebase/firestore"; 

import { getAuth, onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../BDU_SocialApp/firebaseConfig"; // Đã thêm "auth" vào đây để lấy thông tin user hiện tại giống màn tin nhắn

import * as ImagePicker from 'expo-image-picker'; 
import { Video, ResizeMode } from 'expo-av';
import * as ScreenOrientation from 'expo-screen-orientation'; 
import Toast from 'react-native-toast-message';
import LikeButton from './LikeButton';
import NotificationsScreen from './notifications';
import MatchScreen from './match';
import ProfileScreen from './profile';
import MenuScreen from './menu';
import MessagesScreen from './messages';
import CampusRadarScreen from './CampusRadarScreen';


// Hàm chống bấm dồn dập
function useDebounceClick(callback, delay = 300) {
  const isReady = useRef(true);

  return (...args) => {
    if (!isReady.current) return;
    isReady.current = false;
    callback(...args);
    setTimeout(() => {
      isReady.current = true;
    }, delay);
  };
}


const BDU_RED = '#C8102E';
const BDU_BG = '#F4F6F9';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const currentUserId = auth.currentUser?.uid || 'guest';
const DEFAULT_AVATAR = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png';


const MOCK_POSTS = [];
const SystemNotice = () => {
  // ẨN HOÀN TOÀN TẠM THỜI ĐỂ CHUYỂN VÀO CHUÔNG THÔNG BÁO
  return null; 

  /* LƯU LẠI CODE CŨ KHI CẦN DÙNG LẠI:
  return (
    <View style={styles.noticeCard}>
      <View style={styles.noticeHeader}>
        <View style={styles.noticeAuthorContainer}>
          <Image source={{ uri: item.avatar }} style={styles.noticeAvatar} />
          <View>
            <Text style={styles.noticeAuthor}>{item.author}</Text>
            <Text style={styles.noticeTime}>{item.time}</Text>
          </View>
        </View>
        <View style={styles.noticeBadge}>
          <Text style={styles.noticeBadgeText}>Thông báo</Text>
        </View>
      </View>
      <Text style={styles.noticeContent}>{item.content}</Text>
    </View>
  );
  */
};

const getTimeAgo = (timestamp) => {
  if (!timestamp) return "Vừa xong";

  // Hỗ trợ Firebase Timestamp
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  let interval = Math.floor(seconds / 31536000);
  if (interval >= 1) return `${interval} năm`;

  interval = Math.floor(seconds / 2592000);
  if (interval >= 1) return `${interval} tháng`;

  interval = Math.floor(seconds / 604800);
  if (interval >= 1) return `${interval} tuần`;

  interval = Math.floor(seconds / 86400);
  if (interval >= 1) return `${interval} ngày`;

  interval = Math.floor(seconds / 3600);
  if (interval >= 1) return `${interval} giờ`;

  interval = Math.floor(seconds / 60);
  if (interval >= 1) return `${interval} phút`;

  return "Vừa xong";
};

// =====================================================================
// COMPONENT CON: BÌNH LUẬN 
// =====================================================================

const CommentItem = ({ cmt, isReply, handleCommentOptions, handleReply, currentUser, activePostId }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Xác định trạng thái dựa trên dữ liệu Firebase thay vì state cục bộ
  const hasLiked = cmt.likedBy && cmt.likedBy.includes(currentUser.id);
  const hasDisliked = cmt.dislikedBy && cmt.dislikedBy.includes(currentUser.id);
  
  // Đếm số lượng
  const likesCount = cmt.likedBy ? cmt.likedBy.length : 0;
  const dislikesCount = cmt.dislikedBy ? cmt.dislikedBy.length : 0;

  const onReact = async (type) => {
    // Hiệu ứng animation
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.5, duration: 150, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 150, useNativeDriver: true })
    ]).start();

    // Nếu không có thông tin user hoặc bài viết thì bỏ qua
    if (!activePostId || !currentUser.id) return;

    // Trỏ tới document của bình luận này trên Firebase
    const commentRef = doc(db, "posts", activePostId, "comments", cmt.id);

    try {
      if (type === 'like') {
        if (hasLiked) {
          // Bỏ like
          await updateDoc(commentRef, { likedBy: arrayRemove(currentUser.id) });
        } else {
          // Thêm like, đồng thời gỡ dislike (nếu trước đó lỡ bấm dislike)
          await updateDoc(commentRef, {
            likedBy: arrayUnion(currentUser.id),
            ...(hasDisliked ? { dislikedBy: arrayRemove(currentUser.id) } : {})
          });
        }
      } else if (type === 'dislike') {
        if (hasDisliked) {
          // Bỏ dislike
          await updateDoc(commentRef, { dislikedBy: arrayRemove(currentUser.id) });
        } else {
          // Thêm dislike, đồng thời gỡ like (nếu trước đó lỡ bấm like)
          await updateDoc(commentRef, {
            dislikedBy: arrayUnion(currentUser.id),
            ...(hasLiked ? { likedBy: arrayRemove(currentUser.id) } : {})
          });
        }
      }
    } catch (error) {
      console.log("Lỗi khi tương tác bình luận: ", error);
    }
  };

  return (
    <View style={[styles.commentItem, isReply && styles.replyCommentItem]}>
      <Image source={{ uri: cmt.avatar }} style={styles.commentAvatar} />
      <View style={{ flex: 1 }}>
        <View style={styles.commentBubble}>
          <Text style={styles.commentAuthor}>{cmt.author}</Text>
          <Text style={styles.commentText}>{cmt.text}</Text>
        </View>
        <View style={styles.commentActionsWrap}>
          <Text style={styles.commentTimeText}>{getTimeAgo(cmt.time)}</Text>
          
          {/* Nút Like kèm bộ đếm */}
          <TouchableOpacity onPress={() => onReact('like')} style={{ paddingHorizontal: 5, flexDirection: 'row', alignItems: 'center' }}>
            <Animated.View style={hasLiked ? { transform: [{ scale: scaleAnim }] } : {}}>
              <Ionicons name={hasLiked ? "thumbs-up" : "thumbs-up-outline"} size={16} color={hasLiked ? BDU_RED : '#65676B'} />
            </Animated.View>
            {likesCount > 0 && <Text style={{ fontSize: 12, color: '#65676B', marginLeft: 4 }}>{likesCount}</Text>}
          </TouchableOpacity>

          {/* Nút Dislike kèm bộ đếm */}
          <TouchableOpacity onPress={() => onReact('dislike')} style={{ paddingHorizontal: 5, flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name={hasDisliked ? "thumbs-down" : "thumbs-down-outline"} size={16} color={hasDisliked ? '#1A1A1A' : '#65676B'} />
            {dislikesCount > 0 && <Text style={{ fontSize: 12, color: '#65676B', marginLeft: 4 }}>{dislikesCount}</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => handleReply(cmt)}>
            <Text style={styles.commentActionText}>Phản hồi</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleCommentOptions(cmt)}>
            <Text style={styles.commentActionText}>Tùy chọn</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

// =====================================================================
// COMPONENT CON: BÀI VIẾT 
// =====================================================================
const PostItem = ({ 
  item, 
  handlePostOptions, 
  handleShare, 
  openCommentModal, 
  visibleItemIds, 
  currentUser, 
  handleAddFriend,
  sentRequests,
  myFriends 
}) => {
  const isSent = sentRequests && sentRequests[item.userId];
  const videoRef = useRef(null); 
  const [isMuted, setIsMuted] = useState(true);
  const [videoStatus, setVideoStatus] = useState({});
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isVisible = visibleItemIds.includes(item.id);
  const lastTap = useRef(null);

  useEffect(() => {
    if (videoRef.current && !isFullscreen) { 
      if (isVisible) videoRef.current.playAsync();
      else videoRef.current.pauseAsync();
    }
  }, [isVisible, isFullscreen]);

  const handleVideoPress = () => {
    const now = Date.now();
    if (lastTap.current && (now - lastTap.current) < 300) {
      toggleFullscreen();
    } else {
      lastTap.current = now;
      if (videoStatus.isPlaying) videoRef.current.pauseAsync();
      else videoRef.current.playAsync();
    }
  };

  const toggleFullscreen = async () => {
    if (!isFullscreen) {
      setIsFullscreen(true);
      if (videoRef.current) await videoRef.current.presentFullscreenPlayer();
    } else {
      setIsFullscreen(false);
      if (videoRef.current) await videoRef.current.dismissFullscreenPlayer();
    }
  };

  const handleFullscreenUpdate = async ({ fullscreenUpdate }) => {
    if (fullscreenUpdate === 0 || fullscreenUpdate === 1) {
      await ScreenOrientation.unlockAsync(); 
    } else if (fullscreenUpdate === 3) {
      setIsFullscreen(false);
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP); 
    }
  };

  return (
    <View style={styles.postCard}>
      {/* --- 1. HEADER BÀI VIẾT --- */}
      <View style={styles.postHeader}>
        <TouchableOpacity 
          activeOpacity={0.8}
          onPress={() => {
            if (item.userId === currentUser?.id) {
              router.push('/profile');
            } else {
              router.push({ pathname: '/UserProfileScreen', params: { userId: item.userId } });
            }
          }}
        >
          <Image source={{ uri: item.avatar || DEFAULT_AVATAR }} style={styles.postAvatar} />
        </TouchableOpacity>
        
        <View style={styles.postInfo}>
          <View style={styles.authorRow}>
            <TouchableOpacity 
              activeOpacity={0.8}
              onPress={() => {
                if (item.userId === currentUser?.id) {
                  router.push('/profile');
                } else {
                  router.push({ pathname: '/UserProfileScreen', params: { userId: item.userId } });
                }
              }}
            >
              <Text style={styles.postAuthor} numberOfLines={1}>
                {item.author || 'Người dùng ẩn danh'}
              </Text>
            </TouchableOpacity>
            
            {/* Nút Kết bạn nhỏ gọn tinh tế */}
            {!myFriends?.[item.userId] && item.userId && currentUser && item.userId !== currentUser.id && (
              <TouchableOpacity
                style={[styles.addFriendBtn, isSent && styles.addFriendBtnSent]}
                activeOpacity={0.7}
                onPress={() => handleAddFriend(item)}
              >
                <Ionicons
                  name={isSent ? 'checkmark' : 'person-add-outline'}
                  size={12}
                  color={isSent ? "#34C759" : BDU_RED}
                  style={{ marginRight: 3 }}
                />
                <Text style={[styles.addFriendText, isSent && styles.addFriendTextSent]}>
                  {isSent ? 'Đã gửi' : 'Kết bạn'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          
          <Text style={styles.postTime}>
            {typeof item.time === 'object' && item.time?.toDate 
              ? item.time.toDate().toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) 
              : (item.time || 'Vừa xong')}
          </Text>
        </View>

        {(currentUser?.id === item.userId || currentUser?.role === 'admin') && (
          <TouchableOpacity onPress={() => handlePostOptions(item)} style={styles.moreBtn} activeOpacity={0.5}>
            <Ionicons name="ellipsis-horizontal" size={18} color="#8A8D91" />
          </TouchableOpacity>
        )}
      </View>
      
      {/* --- 2. NỘI DUNG CHỮ --- */}
      {item.content ? <Text style={styles.postContent}>{item.content}</Text> : null}
      
      {/* --- 3. NỘI DUNG ẢNH --- */}
      {item.image && (
        <View style={styles.mediaWrapper}>
          <Image source={{ uri: item.image }} style={styles.postImage} resizeMode="cover" />
        </View>
      )}
      
      {/* --- 4. NỘI DUNG VIDEO --- */}
      {item.video && (
        <View style={styles.videoContainer}>
          <TouchableWithoutFeedback onPress={handleVideoPress}>
            <View style={styles.postVideo}>
              <Video
                ref={videoRef}
                source={{ uri: item.video }}
                style={StyleSheet.absoluteFillObject}
                useNativeControls={isFullscreen}
                resizeMode={ResizeMode.COVER}
                isLooping
                isMuted={isMuted}
                onPlaybackStatusUpdate={status => setVideoStatus(() => status)}
                onFullscreenUpdate={handleFullscreenUpdate}
              />
              {!isFullscreen && (
                <>
                  <TouchableOpacity style={styles.muteBtn} onPress={() => setIsMuted(!isMuted)}>
                    <Ionicons name={isMuted ? "volume-mute" : "volume-high"} size={14} color="#FFF" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.fullscreenBtn} onPress={toggleFullscreen}>
                    <Ionicons name="expand" size={14} color="#FFF" />
                  </TouchableOpacity>
                  {!videoStatus?.isPlaying && (
                    <View style={styles.playIconOverlay}>
                      <Ionicons name="play" size={32} color="rgba(255,255,255,0.9)" />
                    </View>
                  )}
                </>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      )}
      
      {/* --- 5. THỐNG KÊ --- */}
      <View style={styles.postStats}>
        <View style={styles.statsLeft}>
          <View style={styles.likeIconBg}>
            <Ionicons name="heart" size={10} color="#FFF" />
          </View>
          <Text style={styles.statsText}>{item.likedBy?.length || item.likes || 0}</Text>
        </View>
        <Text style={styles.statsText}>{item.comments || 0} bình luận</Text>
      </View>

      <View style={styles.postDivider} />

      {/* --- 6. NÚT TƯƠNG TÁC CAO CẤP --- */}
      <View style={styles.postActions}>
        <View style={{ flex: 1, marginRight: 6 }}>
          <LikeButton 
            postId={item.id}
            likedBy={item.likedBy}
            currentUserId={currentUser?.id}
          />
        </View>

        <TouchableOpacity style={styles.pillBtn} activeOpacity={0.7} onPress={() => openCommentModal(item)}>
          <Ionicons name="chatbubble-outline" size={18} color="#65676B" />
          <Text style={styles.actionText}>Bình luận</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const renderListHeader = () => (
  <View style={styles.headerWrapper}>
    {/* KHU VỰC Ô ĐĂNG BÀI CAO CẤP */}
    <View style={styles.createPostCard}>
      <View style={styles.inputSection}>
        <Image 
          source={{ uri: currentUser?.avatar?.trim() ? currentUser.avatar : DEFAULT_AVATAR }} 
          style={styles.userAvatar} 
        />
        <TouchableOpacity 
          style={styles.inputButton} 
          activeOpacity={0.7}
          onPress={() => {
            setNewPostText(""); 
            setSelectedImage(null); 
            setSelectedVideo(null); 
            setEditingPostId(null); 
            setModalVisible(true);
          }}
        >
          <Text style={styles.inputText}>
            {`Bạn đang nghĩ gì, ${currentUser?.name ? currentUser.name.split(' ').pop() : ''}?`}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.createActions}>
        <TouchableOpacity style={styles.createActionBtn} activeOpacity={0.6} onPress={pickImage}>
          <Ionicons name="image-outline" size={20} color="#34C759" />
          <Text style={styles.createActionText}>Ảnh / Video</Text>
        </TouchableOpacity>
        
        <View style={styles.verticalDivider} />

        <TouchableOpacity style={styles.createActionBtn} activeOpacity={0.6} onPress={takePhoto}>
          <Ionicons name="camera-outline" size={20} color="#0084FF" />
          <Text style={styles.createActionText}>Chụp ảnh</Text>
        </TouchableOpacity>
      </View>
    </View>
    <View style={styles.thickDivider} />
    <SystemNotice />
  </View>

  
);
// =====================================================================
// MÀN HÌNH CHÍNH
// =====================================================================
export default function FeedScreen() {
  // CẬP NHẬT 2: State lưu trữ thông tin người dùng đang đăng nhập
  const [currentUser, setCurrentUser] = useState({
    id: null,
    name: "Đang tải...",
    avatar: "https://i.pravatar.cc/100?img=1" 
  });

  const [posts, setPosts] = useState([]); 
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [visibleItemIds, setVisibleItemIds] = useState([]);
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current; 
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    setVisibleItemIds(viewableItems.map(v => v.item.id));
  }).current;

  const [notifications, setNotifications] = useState([]);
  const [notificationModalVisible, setNotificationModalVisible] = useState(false);
  const [sentRequests, setSentRequests] = useState({});

  const [modalVisible, setModalVisible] = useState(false);
  const [newPostText, setNewPostText] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [editingPostId, setEditingPostId] = useState(null); 
  const [selectedImage, setSelectedImage] = useState(null); 
  const [selectedVideo, setSelectedVideo] = useState(null); 

  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [activePost, setActivePost] = useState(null); 
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState([]); 
  const [isCommenting, setIsCommenting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null); 
  const [sendingComment, setSendingComment] = useState(false);
  const router = useRouter();
  const [myFriends, setMyFriends] = useState({});
  const [menuVisible, setMenuVisible] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [activeTab, setActiveTab] = useState('feed');
  const [radarVisible, setRadarVisible] = useState(false);
  const flatListRef = useRef(null);
  const [showScrollTopBtn, setShowScrollTopBtn] = useState(false);
  const lastScrollY = useRef(0);
  const [isRefreshingTop, setIsRefreshingTop] = useState(false);
  
  // CẬP NHẬT 3: Lắng nghe Auth và Fetch User Firestore
  useEffect(() => {
    const auth = getAuth();
    const unsubscribeAuth = onAuthStateChanged(auth, async(user)=>{
      if (user) {
        // Lấy thông tin chi tiết từ collection 'users'
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = userSnap.data();
          setCurrentUser({
  id: user.uid,
  name: userData.fullName || userData.name || user.displayName || "Sinh viên BDU",
  avatar: userData.avatar || user.photoURL || "https://i.pravatar.cc/100?img=1",
  role: userData.role || "user"
});
        } else {
          // Fallback nếu người dùng chưa cập nhật profile trong Firestore
          setCurrentUser({
  id: user.uid,
  name: user.displayName || "Sinh viên BDU",
  avatar: user.photoURL || "https://i.pravatar.cc/100?img=1",
  role: "user"
});
        }
      }
    });
    return unsubscribeAuth;
  }, []);

  
  useEffect(() => {
  if (!currentUser?.id) return;

  setLoading(true);

  // Realtime Posts
  const postsQuery = query(
    collection(db, "posts"),
    orderBy("time", "desc")
  );

  const unsubscribePosts = onSnapshot(
    postsQuery,
    (snapshot) => {
      const data = snapshot.docs.map((doc) => {
        const item = doc.data();

        let formattedTime = "Vừa xong";

        if (item.time?.toDate) {
          const date = item.time.toDate();

          formattedTime =
            `${date.getHours().toString().padStart(2, "0")}:` +
            `${date.getMinutes().toString().padStart(2, "0")} - ` +
            `${date.getDate()}/${date.getMonth() + 1}`;
        }

        return {
          id: doc.id,
          ...item,
          time: formattedTime,
          likes: item.likes || 0,
          comments: item.comments || 0,
          likedBy: item.likedBy || [],
        };
      });

      setPosts(data);
      setLoading(false);
    },
    (error) => {
      console.log(error);
      setLoading(false);
    }
  );

  // Friends realtime
  const friendsRef = collection(db, "users", currentUser.id, "friends");

  const unsubscribeFriends = onSnapshot(friendsRef, (snapshot) => {
    const friends = {};

    snapshot.forEach((doc) => {
      friends[doc.id] = true;
    });

    setMyFriends(friends);
  });

  return () => {
    unsubscribePosts();
    unsubscribeFriends();
  };
}, [currentUser?.id]);

  const handleRefresh = async () => {
  setRefreshing(true);

  setTimeout(() => {
    setRefreshing(false);
  }, 600);
};

  // MỚI: Lắng nghe Notifications & Friend Requests Realtime
  useEffect(() => {
    // Đảm bảo currentUser tồn tại trước khi lấy id để tránh lỗi crash
    if (!currentUser || !currentUser.id) return;

    // Lắng nghe Notifications (Đã đổi currentUser.uid thành currentUser.id)
    const qNotif = query(
      collection(db, "notifications"), 
      where("toUserId", "==", currentUser.id), 
      orderBy("time", "desc")
    );
    const unsubNotif = onSnapshot(qNotif, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setNotifications(notifs);
    });

    // Lắng nghe Friend Requests
    const qFriend = query(
      collection(db, "friend_requests"), 
      where("fromUserId", "==", currentUser.id)
    );
    const unsubFriend = onSnapshot(qFriend, (snapshot) => {
      const requests = {};
      snapshot.docs.forEach(doc => {
        requests[doc.data().toUserId] = doc.id;
      });
      setSentRequests(requests);
    });

    return () => {
      unsubNotif();
      unsubFriend();
    };
  }, [currentUser?.id]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Bảo mật', 'Ứng dụng cần quyền truy cập thư viện ảnh.');
    
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All, 
      allowsEditing: true, 
      aspect: [4, 3],      
      quality: 0.8,        
      base64: true, 
    });
    if (!result.canceled) {
      if (result.assets[0].type === 'video') {
        setSelectedVideo(result.assets[0].uri); 
        setSelectedImage(null); 
      } else {
        setSelectedImage(`data:image/jpeg;base64,${result.assets[0].base64}`); 
        setSelectedVideo(null); 
      }
      setModalVisible(true);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Bảo mật', 'Ứng dụng cần quyền camera.');
    
    let result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      aspect: [4, 3], 
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled) {
      if (result.assets[0].type === 'video') {
        setSelectedVideo(result.assets[0].uri);
        setSelectedImage(null);
      } else {
        setSelectedImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
        setSelectedVideo(null);
      }
      setModalVisible(true);
    }
  };

  const deletePost = async (item) => {
  const isOwner = currentUser?.id === item.userId;
  const isAdmin = currentUser?.role === "admin";

  if (!isOwner && !isAdmin) {
    Alert.alert("Thông báo", "Bạn không có quyền xóa bài viết này.");
    return;
  }

  try {
    await deleteDoc(doc(db, "posts", item.id));

    Toast.show({
      type: "success",
      text1: "Đã xóa bài viết",
      visibilityTime: 1500,
    });

  } catch (error) {
    console.log(error);

    Alert.alert("Lỗi", "Không thể xóa bài viết.");
  }
};

  const handleCreatePost = async () => {
  // 1. Kiểm tra nếu không có nội dung, ảnh hoặc video thì bỏ qua
  if (newPostText.trim() === "" && !selectedImage && !selectedVideo) return;
  
  setIsPosting(true);

  try {
    // 2. Xác định tên, avatar và vai trò dựa trên trạng thái ẨN DANH
    const postAuthorName = isAnonymous ? "Người dùng ẩn danh" : (currentUser?.name || "Người dùng");
    const postAuthorAvatar = isAnonymous ? "https://arbrealettres.wordpress.com/wp-content/uploads/2018/07/anonyme.png" : (currentUser?.avatar || "");
    const postRole = currentUser?.role || "student";

    if (editingPostId) {
      // --- LOGIC CHỈNH SỬA BÀI VIẾT ---
      await updateDoc(doc(db, "posts", editingPostId), {
        content: newPostText,
        author: postAuthorName,
        avatar: postAuthorAvatar,
        isAnonymous: isAnonymous,
        ...(selectedImage ? { image: selectedImage, video: null } : {}), 
        ...(selectedVideo ? { video: selectedVideo, image: null } : {})
      });
      setEditingPostId(null);
    } else {
      const now = Timestamp.now();

await addDoc(collection(db, "posts"), {
  author: postAuthorName,
  avatar: postAuthorAvatar,
  userId: currentUser.id,
  role: postRole,
  authorRole: postRole,
  isAnonymous,
  content: newPostText,
  image: selectedImage || null,
  video: selectedVideo || null,
  time: now,
  createdAt: now,
  likedBy: [],
  likes: 0,
  comments: 0
});
    }

    // 3. Reset toàn bộ form sau khi đăng thành công
    setModalVisible(false);
    setNewPostText("");
    setSelectedImage(null);
    setSelectedVideo(null);
    setIsAnonymous(false); // Trở về mặc định không ẩn danh
  } catch (error) {
    console.error("Lỗi đăng bài lên Firebase:", error);
    Alert.alert("Lỗi", "Không thể đăng bài viết, vui lòng thử lại!");
  } finally {
    setIsPosting(false);
  }
};

  const handleShare = async (content) => {
    try { await Share.share({ message: `Xem bài viết này trên BDU Social:\n\n"${content}"` }); } catch (error) {}
  };

  const handlePostOptions = (item) => {

  const isOwner = currentUser.id === item.userId;
  const isAdmin = currentUser.role === "admin";

  const buttons = [];

  // Chủ bài viết mới được sửa
  if (isOwner) {
    buttons.push({
      text: "Chỉnh sửa",
      onPress: () => {
        setNewPostText(item.content);
        setSelectedImage(item.image || null);
        setSelectedVideo(item.video || null);
        setEditingPostId(item.id);
        setModalVisible(true);
      }
    });
  }

  // Chủ bài viết hoặc Admin được xóa
  if (isOwner || isAdmin) {
  buttons.push({
    text: "Xóa bài viết",
    style: "destructive",
    onPress: () => deletePost(item)
  });
}

  buttons.push({
    text: "Hủy",
    style: "cancel"
  });

  Alert.alert(
    "Tùy chọn",
    "Bạn muốn làm gì?",
    buttons
  );
};

  const openCommentModal = (post) => {
  setComments([]);            // reset ngay
  setActivePost(post);
  setCommentModalVisible(true);
  setEditingCommentId(null);
  setReplyingTo(null);
  setCommentText("");
};


 const handleAddFriend = async (targetUser) => {
  try {
    // Lấy ID chính xác của người nhận từ bài viết
    const recipientId = targetUser.userId || targetUser.id;
    const existingRequestId = sentRequests?.[recipientId]; 

    if (existingRequestId) {
      // Hủy / Thu hồi lời mời kết bạn
      await deleteDoc(doc(db, "friend_requests", existingRequestId));

      Toast.show({
        type: 'info',
        text1: 'Đã thu hồi lời mời kết bạn!',
        visibilityTime: 1500,
      });
    } else {
      // Gửi lời mời kết bạn mới
      await addDoc(collection(db, "friend_requests"), {
        fromUserId: currentUser.id,
        toUserId: recipientId,
        status: "pending",
        time: Timestamp.now()
      });

      Toast.show({
        type: 'success',
        text1: 'Đã gửi lời mời kết bạn!',
        visibilityTime: 1500,
      });
    }
  } catch (error) {
    console.log("Lỗi xử lý kết bạn:", error);
    Toast.show({
      type: 'error',
      text1: 'Có lỗi xảy ra, vui lòng thử lại!',
    });
  }
};

// DÁN ĐOẠN NÀY DƯỚI HÀM handleAddFriend CỦA BẠN

  useEffect(() => {
    if (!activePost?.id) {
        setComments([]);
        return;
    }

    const q = query(
        collection(db, "posts", activePost.id, "comments"),
        orderBy("time", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }));

        setComments(data);
    });

    return unsubscribe;
}, [activePost?.id]);

  const handleSendComment = async () => {
  if (commentText.trim() === "") return;

  setIsCommenting(true);
  setSendingComment(true);

  try {
    if (editingCommentId) {
      await updateDoc(
        doc(db, "posts", activePost.id, "comments", editingCommentId),
        { text: commentText }
      );

      setEditingCommentId(null);

    } else {
      await addDoc(
        collection(db, "posts", activePost.id, "comments"),
        {
          author: currentUser.name,
          avatar: currentUser.avatar,
          userId: currentUser.id,
          text: commentText,
          time: Timestamp.now(),
          parentId: replyingTo ? replyingTo.id : null,
        }
      );

      if (!replyingTo) {
        await updateDoc(doc(db, "posts", activePost.id), {
          comments: increment(1)
        });
      }
    }

    setCommentText("");
    setReplyingTo(null);
    Keyboard.dismiss();

    Toast.show({
  type: "success",
  text1: "Đã đăng bình luận",
  position: "top",
  visibilityTime: 1500,
  topOffset: 70,
});

  } catch (error) {
    Toast.show({
      type: "error",
      text1: "Không thể gửi bình luận",
      position: "bottom",
    });

    console.log(error);
  } finally {
    setIsCommenting(false);
    setSendingComment(false);
  }
};

  const handleCommentOptions = (cmt) => {
    Alert.alert("Tùy chọn bình luận", "Bạn muốn làm gì?", [
      { text: "Chỉnh sửa", onPress: () => { setCommentText(cmt.text); setEditingCommentId(cmt.id); setReplyingTo(null); } },
      { text: "Xóa", style: "destructive", onPress: async () => {
          Alert.alert("Xác nhận", "Xóa bình luận này?", [
            { text: "Hủy", style: "cancel" },
            { text: "Xóa", style: "destructive", onPress: async () => {
                await deleteDoc(doc(db, "posts", activePost.id, "comments", cmt.id));
                if(!cmt.parentId) await updateDoc(doc(db, "posts", activePost.id), { comments: increment(-1) });
              }
            }
          ]);
        }
      },
      { text: "Hủy", style: "cancel" }
    ]);
  };

 const renderListHeader = () => {
  return (
    <View style={styles.headerWrapper}>
      {/* 1. KHU VỰC Ô ĐĂNG BÀI (Full viền trắng, gọn gàng) */}
      <View style={styles.createPostCard}>
        
        {/* Hàng 1: Avatar và Ô nhập liệu */}
        <View style={styles.inputSection}>
          <Image 
            source={{ uri: currentUser?.avatar?.trim() ? currentUser.avatar : DEFAULT_AVATAR }} 
            style={styles.userAvatar} 
          />
          <TouchableOpacity 
            style={styles.inputButton} 
            activeOpacity={0.6} // Tăng hiệu ứng mờ khi bấm để có animation nhẹ
            onPress={() => {
              setNewPostText(""); 
              setSelectedImage(null); 
              setSelectedVideo(null); 
              setEditingPostId(null); 
              setModalVisible(true);
            }}
          >
            <Text style={styles.inputText}>
              {`Bạn đang nghĩ gì, ${currentUser?.name ? currentUser.name.split(' ').pop() : ''}?`}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Hàng 2: Các nút chức năng (Chỉ giữ Ảnh/Video và Chụp ảnh) */}
        <View style={styles.createActions}>
          <TouchableOpacity style={styles.createActionBtn} activeOpacity={0.5} onPress={pickImage}>
            <Ionicons name="images" size={24} color="#45BD62" />
            <Text style={styles.createActionText}>Ảnh / Video</Text>
          </TouchableOpacity>
          
          {/* Đường kẻ dọc chia đôi 2 nút cho rõ ràng */}
          <View style={styles.verticalDivider} />

          <TouchableOpacity style={styles.createActionBtn} activeOpacity={0.5} onPress={takePhoto}>
            <Ionicons name="camera" size={24} color="#0084FF" />
            <Text style={styles.createActionText}>Chụp ảnh</Text>
          </TouchableOpacity>
        </View>

      </View>

      {/* DẢI PHÂN CÁCH DÀY - BÍ QUYẾT ĐỂ TÁCH BIỆT CÁC KHỐI */}
      <View style={styles.thickDivider} />

      {/* KHU VỰC STORY SẼ NẰM Ở ĐÂY NẾU BẠN THÊM VÀO */}
      {/* <StorySection /> */}
      {/* <View style={styles.thickDivider} /> */}

      {/* 2. THẺ THÔNG BÁO HỆ THỐNG */}
      <SystemNotice />
      
    </View>
  );
};


 return (
    <>
      <SafeAreaView style={[styles.container, { backgroundColor: '#FFF', flex: 1 }]}>
        <Tabs.Screen options={{ headerShown: false }} />
        {/* Tối ưu thanh Status Bar tone sáng để clean hơn */}
        <StatusBar barStyle="dark-content" backgroundColor="#FFF" translucent={false} />
        
        {/* Bọc toàn bộ nội dung trong View nền BDU_BG */}
        <View style={{ flex: 1, backgroundColor: BDU_BG }}>
          
          {/* =======================================================
              HEADER CHUẨN TONE FLAT TỐI GIẢN (Giống màn Match)
              ======================================================= */}
          <View style={styles.appHeaderFlat}>
  <View style={styles.headerTitleContainer}>
    
    {/* KHỐI BỌC TOÀN BỘ LOGO VÀ CHỮ */}
    <View style={{ 
      flexDirection: 'row', 
      alignItems: 'center' 
    }}>
      
      {/* 1. HÌNH ẢNH LOGO (Chữ B trong hình tròn đỏ) */}
      <Image 
        source={require('../assets/images/logo-bdu.png')} 
        style={{ 
          width: 46,   // Chỉnh kích thước to lên một chút để cân đối với 2 dòng chữ
          height: 46 
        }} 
        resizeMode="contain" 
      />

      {/* 2. KHỐI CHỨA CHỮ BÊN PHẢI */}
      <View style={{ 
        marginLeft: 1.5,        // Tạo khoảng cách hở với logo cho thoáng giống hình
        justifyContent: 'center',
      }}>
        
        {/* DÒNG 1: Chữ "BDUSocial" */}
        {/* Dùng 1 thẻ Text bọc ngoài để 2 chữ tự động nằm sát ngang hàng nhau */}
        <Text style={{ 
          fontSize: 24, 
          fontWeight: '900', 
          letterSpacing: -1.5, // Ép chữ hơi sát lại cho mạnh mẽ
          lineHeight: 28,      // Cố định chiều cao dòng để không bị lệch
        }}>
          {/* Mẹo: Dùng textShadowColor trùng với màu chữ để "đắp" thêm độ dày cho nét */}
          <Text style={{ 
            color: '#fc0707',
            textShadowColor: '#fc0707', 
            textShadowOffset: { width: 0.5, height: 0.5 },
            textShadowRadius: 0.5
          }}>BDU</Text>

          <Text style={{ 
            color: '#1A1A1A',
            textShadowColor: '#1A1A1A', 
            textShadowOffset: { width: 0.5, height: 0.5 },
            textShadowRadius: 0.5
          }}>Social</Text>
        </Text>

        {/* DÒNG 2: Slogan "KẾT NỐI - CHIA SẺ" */}
        <Text style={{ 
          fontSize: 10, 
          fontWeight: '900',   // Đã nâng từ 700 lên 900 để chữ đậm đà hơn
          color: '#8A8D91',    // Màu xám trung tính tĩnh chuẩn thiết kế
          letterSpacing: 2.5,  // Kéo giãn khoảng cách giữa các chữ cái ra xa nhau
          marginTop: -2        // Kéo xích lên một chút cho sát với dòng trên
        }}>
          KẾT NỐI - CHIA SẺ
        </Text>
        
      </View>
    </View>

         {/* Cụm nút Action bên phải */}
          <View style={{ position: 'absolute', right: 16, flexDirection: 'row', gap: 8 }}>
            
            {/* NÚT MỞ RADAR KẾT NỐI */}
            <TouchableOpacity 
              activeOpacity={0.7} 
              onPress={() => setRadarVisible(true)} 
              style={[styles.actionIconBtn, { backgroundColor: 'rgba(200, 16, 46, 0.1)' }]}
            >
              <MaterialCommunityIcons name="radar" size={24} color={BDU_RED} />
            </TouchableOpacity>

          </View>
        </View>
        </View>

        {/* =======================================================
  {/* =======================================================
    TOP NAVIGATION NGANG (5 TAB: BẢNG TIN, MATCH, THÔNG BÁO, PROFILE, MENU)
    ======================================================= */}
<View style={styles.topMenuBar}>
  <ScrollView 
    horizontal 
    showsHorizontalScrollIndicator={false} 
    contentContainerStyle={{ paddingHorizontal: 12, alignItems: 'center' }}
  >
    {/* Tab 1: Bảng tin */}
    <TouchableOpacity 
      style={[styles.menuTabItem, activeTab === 'feed' && styles.menuTabItemActive]} 
      activeOpacity={0.8}
      onPress={() => setActiveTab('feed')}
    >
      <Ionicons name="home" size={20} color={activeTab === 'feed' ? BDU_RED : "#65676B"} />
      <Text style={[styles.menuTabText, activeTab === 'feed' && styles.menuTabTextActive]}>Bảng tin</Text>
    </TouchableOpacity>

    {/* Tab 2: Match */}
    <TouchableOpacity 
      style={[styles.menuTabItem, activeTab === 'match' && styles.menuTabItemActive]} 
      activeOpacity={0.7}
      onPress={() => setActiveTab('match')} // Chỉ gọi setActiveTab tại chỗ
    >
      <Ionicons name="people-outline" size={20} color={activeTab === 'match' ? BDU_RED : "#65676B"} />
      <Text style={[styles.menuTabText, activeTab === 'match' && styles.menuTabTextActive]}>Match</Text>
    </TouchableOpacity>

    {/* Tab 3: Thông báo */}
        <TouchableOpacity 
          style={[styles.menuTabItem, activeTab === 'notification' && styles.menuTabItemActive]} 
          activeOpacity={0.7}
          onPress={() => {
            // Lệnh này bắt buộc phải có để báo cho màn hình chính chuyển tab
            setActiveTab('notification');
          }}
        >
          <View style={{ position: 'relative' }}>
            <Ionicons name="notifications-outline" size={20} color={activeTab === 'notification' ? BDU_RED : "#65676B"} />
            
            {/* Chấm đỏ: Hiện khi chưa đọc HOẶC khi acc mới chưa có thông báo nào (length === 0) */}
            {notifications && (notifications.length === 0 || notifications.some(n => !n.read)) && (
              <View style={styles.smallBadgeDot} />
            )}
          </View>
          <Text style={[styles.menuTabText, activeTab === 'notification' && styles.menuTabTextActive]}>Thông báo</Text>
        </TouchableOpacity>

        {/* Tab Tin nhắn (MỚI THÊM) */}
    <TouchableOpacity 
      style={[styles.menuTabItem, activeTab === 'messages' && styles.menuTabItemActive]} 
      activeOpacity={0.7}
      onPress={() => setActiveTab('messages')}
    >
      <Ionicons name="chatbubbles-outline" size={20} color={activeTab === 'messages' ? BDU_RED : "#65676B"} />
      <Text style={[styles.menuTabText, activeTab === 'messages' && styles.menuTabTextActive]}>Tin nhắn</Text>
    </TouchableOpacity>

    {/* Tab 5: Menu */}
    <TouchableOpacity 
      style={[styles.menuTabItem, activeTab === 'menu' && styles.menuTabItemActive]} 
      activeOpacity={0.7}
      onPress={() => setActiveTab('menu')} // CHỈ CẦN DÒNG NÀY THÔI
    >
      <Ionicons name="menu-outline" size={20} color={activeTab === 'menu' ? BDU_RED : "#65676B"} />
      <Text style={[styles.menuTabText, activeTab === 'menu' && styles.menuTabTextActive]}>Menu</Text>
    </TouchableOpacity>
  </ScrollView>
</View> 
         {/* =======================================================
              NỀN BẢNG TIN & CÁC TAB KHÁC (TỐI ƯU HÓA DISPLAY NONE/FLEX)
              ======================================================= */}
          <View style={{ flex: 1, backgroundColor: BDU_BG }}>
            
            {/* 1. Tab Bảng tin */}
            <View style={{ flex: 1, display: activeTab === 'feed' ? 'flex' : 'none' }}>
              {loading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
                  <ActivityIndicator size="large" color={BDU_RED} />
                  <Text style={{ marginTop: 16, color: '#65676B', fontSize: 15, fontWeight: '500' }}>Đang tải bảng tin...</Text>
                </View>
              ) : (
                <FlatList
                  ref={flatListRef}
                  data={(posts && posts.length > 0) ? posts : MOCK_POSTS} 
                  onViewableItemsChanged={onViewableItemsChanged}
                  viewabilityConfig={viewabilityConfig}
                  renderItem={({ item }) => (
                    <PostItem 
                      item={item} 
                      handlePostOptions={handlePostOptions} 
                      handleShare={handleShare} 
                      openCommentModal={openCommentModal} 
                      visibleItemIds={visibleItemIds}
                      currentUser={currentUser}
                      handleAddFriend={handleAddFriend}
                      sentRequests={sentRequests} 
                      myFriends={myFriends}
                    />
                  )}
                  keyExtractor={item => item.id}
                  ListHeaderComponent={renderListHeader}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 30 }}
                  removeClippedSubviews={true}
                  initialNumToRender={5}
                  maxToRenderPerBatch={5}
                  windowSize={10}
                  refreshControl={ <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={BDU_RED} colors={[BDU_RED]} /> }
                  onScroll={(event) => {
                    const currentOffsetY = event.nativeEvent.contentOffset.y;
                    const diff = currentOffsetY - lastScrollY.current;

                    if (currentOffsetY < 700) {
                      if (showScrollTopBtn) setShowScrollTopBtn(false);
                    } else {
                      if (diff > 10 && !showScrollTopBtn) {
                        setShowScrollTopBtn(true);
                      } else if (diff < -10 && showScrollTopBtn) {
                        setShowScrollTopBtn(false);
                      }
                    }
                    lastScrollY.current = currentOffsetY;
                  }}
                  scrollEventThrottle={150}
                />
              )}
            </View>

            {/* 2. Tab Match */}
            <View style={{ flex: 1, display: activeTab === 'match' ? 'flex' : 'none' }}>
              <MatchScreen />
            </View>

            {/* 3. Tab Thông báo */}
            <View style={{ flex: 1, display: activeTab === 'notification' ? 'flex' : 'none' }}>
              <NotificationsScreen />
            </View>

            {/* 4. Tab Menu */}
            <View style={{ flex: 1, display: activeTab === 'menu' ? 'flex' : 'none' }}>
              <MenuScreen currentUser={currentUser} setActiveTab={setActiveTab} />
            </View>

            {/* 5. Tab Tin nhắn */}
            <View style={{ flex: 1, display: activeTab === 'messages' ? 'flex' : 'none' }}>
              <MessagesScreen />
            </View>

          </View>

          {/* =======================================================
          {/* =======================================================
              CÁC MODAL ĐƯỢC GIỮ NGUYÊN BÊN DƯỚI NÀY
              ======================================================= */}
              
          {/* 1. GIAO DIỆN MODAL ĐĂNG BÀI */}
          <Modal visible={modalVisible} animationType="slide" transparent={true} onRequestClose={() => { setModalVisible(false); setEditingPostId(null); setSelectedImage(null); setSelectedVideo(null); }}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <TouchableOpacity onPress={() => { setModalVisible(false); setEditingPostId(null); setSelectedImage(null); setSelectedVideo(null); }} style={{ padding: 5 }}>
                    <Ionicons name="close" size={28} color="#FFF" />
                  </TouchableOpacity>
                  <Text style={styles.modalTitle}>{editingPostId ? "Sửa bài viết" : "Tạo bài viết"}</Text>
                  <TouchableOpacity onPress={handleCreatePost} disabled={isPosting || (newPostText.trim() === "" && !selectedImage && !selectedVideo)}>
                    <Text style={[styles.postButtonText, (isPosting || (newPostText.trim() === "" && !selectedImage && !selectedVideo)) && { color: '#FFB3B3' }]}>{isPosting ? "Đang xử lý..." : "XONG"}</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} style={{ padding: 16 }}>
                  <View style={styles.modalUserInfo}>
                    <Image source={{ uri: currentUser?.avatar }} style={styles.userAvatar} />
                    
                    <View style={{ flex: 1, justifyContent: 'center', paddingLeft: 4 }}>
                      <Text style={[styles.modalUserName, { marginTop: 6, marginBottom: 2 }]}>
                        {currentUser?.name}
                      </Text>
                      
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ fontSize: 13, color: '#65676B', marginRight: 8 }}>
                          Đăng ẩn danh
                        </Text>
                        <Switch 
                          value={isAnonymous} 
                          onValueChange={setIsAnonymous}
                          trackColor={{ false: "#CCD0D5", true: "#C8102E" }}
                          thumbColor={"#FFF"}
                          style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }} 
                        />
                      </View>
                    </View>
                  </View>

                  <TextInput style={styles.textInput} placeholder="Bạn đang nghĩ gì?" placeholderTextColor="#8A8D91" multiline autoFocus value={newPostText} onChangeText={setNewPostText} />

                  {selectedImage && (
                    <View style={styles.previewImageContainer}>
                      <Image source={{ uri: selectedImage }} style={styles.previewImage} />
                      <TouchableOpacity style={styles.removeImageBtn} activeOpacity={0.7} onPress={() => setSelectedImage(null)}>
                        <Ionicons name="close" size={20} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                  )}
                  {selectedVideo && (
                    <View style={styles.previewImageContainer}>
                      <Video source={{ uri: selectedVideo }} style={styles.previewImage} resizeMode={ResizeMode.COVER} isLooping shouldPlay={true} isMuted />
                      <TouchableOpacity style={styles.removeImageBtn} activeOpacity={0.7} onPress={() => setSelectedVideo(null)}>
                        <Ionicons name="close" size={20} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                  )}
                </ScrollView>

                <View style={styles.modalTools}>
                  <TouchableOpacity onPress={pickImage} style={styles.toolBtn} activeOpacity={0.7}><Ionicons name="image" size={24} color="#45BD62" /><Text style={styles.toolBtnText}>Thêm</Text></TouchableOpacity>
                  <TouchableOpacity onPress={takePhoto} style={styles.toolBtn} activeOpacity={0.7}><Ionicons name="camera" size={24} color="#0084FF" /><Text style={styles.toolBtnText}>Chụp / Quay</Text></TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* 2. MODAL BÌNH LUẬN */}
          <Modal visible={commentModalVisible} animationType="slide" transparent onRequestClose={() => setCommentModalVisible(false)}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
              <View style={styles.commentModalContainer}>
                <View style={styles.modalHeader}>
                  <TouchableOpacity onPress={() => setCommentModalVisible(false)}>
                    <Ionicons name="close" size={28} color="#FFF" />
                  </TouchableOpacity>
                  <Text style={styles.modalTitle}>Bình luận</Text>
                  <View style={{ width: 28 }} />
                </View>

                <FlatList
                  data={comments}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <CommentItem
                      cmt={item}
                      isReply={false}
                      handleCommentOptions={handleCommentOptions}
                      handleReply={() => setReplyingTo(item)}
                      currentUser={currentUser}
                      activePostId={activePost?.id}
                    />
                  )}
                  contentContainerStyle={{ padding: 15 }}
                  showsVerticalScrollIndicator={false}
                  style={{ flex: 1 }}
                  ListEmptyComponent={<Text style={{ textAlign: "center", marginTop: 30, color: "#888" }}>Chưa có bình luận</Text>}
                />

                <View style={styles.commentInputWrapper}>
                  <TextInput
                    style={styles.commentInput}
                    placeholder="Viết bình luận..."
                    value={commentText}
                    onChangeText={setCommentText}
                  />
                  <TouchableOpacity disabled={isCommenting} onPress={handleSendComment} activeOpacity={0.7}>
                    {isCommenting ? (
                      <ActivityIndicator size="small" color={BDU_RED} />
                    ) : (
                      <Ionicons name="send" size={24} color={BDU_RED} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </Modal>

          {/* 3. MODAL THÔNG BÁO */}
          <Modal visible={notificationModalVisible} animationType="slide" transparent={true} onRequestClose={() => setNotificationModalVisible(false)}>
            <View style={[styles.modalOverlay, { backgroundColor: 'rgba(240, 237, 237, 0)' }]}> 
              <View style={[styles.modalContent, { height: '80%' }]}>
                <View style={styles.modalHeader}>
                  <View style={{ width: 28 }} />
                  <Text style={styles.modalTitle}>Thông báo</Text>
                  <TouchableOpacity onPress={() => setNotificationModalVisible(false)} style={{ padding: 5 }}>
                    <Ionicons name="close" size={28} color="#FFF" />
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={notifications}
                  keyExtractor={item => item.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity activeOpacity={0.7} style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#F0F2F5', flexDirection: 'row', backgroundColor: item.isRead ? '#FFF' : '#E8F4FF' }}>
                      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#E4E6EB', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                        <Ionicons name="notifications" size={20} color={BDU_RED} />
                      </View>
                      <View style={{ flex: 1, justifyContent: 'center' }}>
                        <Text style={{ fontSize: 15, color: '#1A1A1A', fontWeight: item.isRead ? 'normal' : '600' }}>
                          {item.content || item.message || "Bạn có thông báo mới."}
                        </Text>
                        <Text style={{ fontSize: 13, color: '#8A8D91', marginTop: 4 }}>{getTimeAgo(item.time)}</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 40, color: '#8A8D91', fontSize: 15 }}>Hiện chưa có thông báo mới nào.</Text>}
                />
              </View>
            </View>
          </Modal>
        </View>
        {/* ======================================================= */}
          {/* 4. MÀN HÌNH CAMPUS RADAR (XỊN XÒ) */}
          {/* ======================================================= */}
          <Modal visible={radarVisible} animationType="slide" transparent={false}>
            <CampusRadarScreen onClose={() => setRadarVisible(false)} />
          </Modal>
      </SafeAreaView>
      <Toast />
    </>
  );
};
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F2F5' },
  
  // --- TOP MENU BAR NỔI BẬT ---
  topMenuBar: {
    backgroundColor: '#FFF',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
  },
  menuTabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    backgroundColor: '#F4F6F8',
    borderRadius: 22,
  },
  menuTabItemActive: {
    backgroundColor: 'rgba(200, 16, 46, 0.12)',
  },
  menuTabText: {
    marginLeft: 6,
    fontSize: 13.5,
    fontWeight: '600',
    color: '#65676B',
  },
  menuTabTextActive: {
    color: BDU_RED,
    fontWeight: '700',
  },
  smallBadgeDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BDU_RED,
    borderWidth: 1.5,
    borderColor: '#FFF',
  },

  // --- HEADER FLAT ---
  appHeaderFlat: {
    height: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
  },
  headerTitleContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  actionIconBtn: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(200, 16, 46, 0.08)',
    borderRadius: 19,
  },

  // --- CREATE POST CARD ---
  headerWrapper: { backgroundColor: '#F0F2F5' },
  createPostCard: {
    backgroundColor: '#FFFFFF',
    paddingTop: 14,
  },
  inputSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  userAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: '#E4E6EB',
  },
  inputButton: {
    flex: 1,
    marginLeft: 10,
    backgroundColor: '#F0F2F5',
    height: 42,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 21,
  },
  inputText: {
    color: '#65676B',
    fontSize: 14.5,
  },
  createActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#F0F2F5',
    paddingVertical: 6,
  },
  createActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  createActionText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#4B4C4F',
  },
  verticalDivider: {
    width: 1,
    backgroundColor: '#F0F2F5',
    marginVertical: 8,
  },
  thickDivider: {
    height: 8,
    backgroundColor: '#F0F2F5',
    width: '100%',
  },

  // --- POST CARD CAO CẤP (BO GÓC MƯỢT MÀ, BÓNG ĐỔ TINH TẾ) ---
  // --- POST CARD CAO CẤP (BO GÓC MƯỢT MÀ, KHÔNG VIỀN ĐỎ THÔ SƠ) ---
  postCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 12,
    marginBottom: 14,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    overflow: 'hidden',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    paddingBottom: 10,
  },
  postAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: '#E4E6EB',
  },
  postInfo: {
    flex: 1,
    marginLeft: 10,
    justifyContent: 'center',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  postAuthor: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    marginRight: 6,
  },
  postTime: {
    fontSize: 11.5,
    color: '#8A8D91',
    marginTop: 1,
  },
  moreBtn: { padding: 4 },
  
  postContent: {
    fontSize: 14.5,
    color: '#1C1E21',
    paddingHorizontal: 14,
    paddingBottom: 10,
    lineHeight: 21,
  },
  mediaWrapper: { width: '100%', backgroundColor: '#000' },
  postImage: {
    width: '100%',
    height: 320,
    backgroundColor: '#F0F2F5',
  },

  // --- NÚT KẾT BẠN ---
  addFriendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0F2',
    borderWidth: 1,
    borderColor: '#FCD4D4',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 6,
  },
  addFriendBtnSent: {
    backgroundColor: '#F0F2F5',
    borderColor: '#E4E6EB',
  },
  addFriendText: {
    color: BDU_RED,
    fontSize: 11.5,
    fontWeight: '700',
  },
  addFriendTextSent: {
    color: '#65676B',
  },

  // --- VIDEO ---
  videoContainer: { width: '100%', backgroundColor: '#000', position: 'relative' },
  postVideo: { width: '100%', height: 260, position: 'relative' },
  muteBtn: { position: 'absolute', bottom: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', padding: 6, borderRadius: 14 },
  fullscreenBtn: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', padding: 6, borderRadius: 14 },
  playIconOverlay: { position: 'absolute', top: '50%', left: '50%', transform: [{translateX: -20}, {translateY: -20}], backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 25, width: 48, height: 48, justifyContent: 'center', alignItems: 'center' },

 postStats: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10 }, 
  statsLeft: { flexDirection: 'row', alignItems: 'center' },
  likeIconBg: { backgroundColor: BDU_RED, width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  statsText: { color: '#65676B', fontSize: 13, marginLeft: 5, fontWeight: '500' },
  
  postDivider: {
    height: 1,
    backgroundColor: '#F0F2F5',
    marginHorizontal: 14,
  },
  postActions: { flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 8, gap: 8 },
  pillBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, backgroundColor: '#F8F9FA', borderRadius: 12 },
  actionText: { color: '#4B4C4F', marginLeft: 6, fontWeight: '600', fontSize: 13.5 },

  // --- MODALS & COMMENTS ---
  modalOverlay: { flex: 1, backgroundColor: 'transparent', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', height: '85%', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: BDU_RED, paddingVertical: 14, paddingHorizontal: 16 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#FFF' },
  postButtonText: { fontSize: 15, fontWeight: 'bold', color: '#FFF' },
  modalUserInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  modalUserName: { fontSize: 15, fontWeight: 'bold', color: '#1A1A1A' },
  textInput: { fontSize: 16, color: '#1A1A1A', textAlignVertical: 'top', minHeight: 80 },
  previewImageContainer: { position: 'relative', marginTop: 12, borderRadius: 14, overflow: 'hidden' },
  previewImage: { width: '100%', height: 240, resizeMode: 'cover' },
  removeImageBtn: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 14, width: 28, height: 28, justifyContent: 'center', alignItems: 'center' },
  modalTools: { flexDirection: 'row', gap: 12, borderTopWidth: 1, borderTopColor: '#F0F2F5', paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#FFF' },
  toolBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8F9FA', paddingVertical: 10, borderRadius: 16, borderWidth: 1, borderColor: '#E4E6EB' },
  toolBtnText: { marginLeft: 6, fontWeight: '700', color: '#4A4A4A', fontSize: 13.5 },

  commentModalContainer: { backgroundColor: '#FFF', height: '65%', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  commentItem: { flexDirection: 'row', marginBottom: 12 },
  commentAvatar: { width: 34, height: 34, borderRadius: 17, marginRight: 8, borderWidth: 0.5, borderColor: '#E4E6EB' },
  commentBubble: { backgroundColor: '#F0F2F5', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, flexShrink: 1, alignSelf: 'flex-start' },
  commentAuthor: { fontWeight: '700', fontSize: 12.5, color: '#1A1A1A', marginBottom: 2 },
  commentText: { fontSize: 13.5, color: '#2C2C2C', lineHeight: 18 },
  commentActionsWrap: { flexDirection: 'row', alignItems: 'center', marginTop: 3, marginLeft: 8, gap: 10 },
  commentTimeText: { fontSize: 11, color: '#8A8D91', fontWeight: '500' },
  commentActionText: { fontSize: 11, color: '#65676B', fontWeight: '700' },
  replyBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F0F2F5', paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#E4E6EB' },
  replyBannerText: { fontSize: 12.5, color: '#65676B', fontWeight: '600' },
  replyCommentItem: { marginLeft: 40, marginTop: 2, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: '#E4E6EB' },
  commentInputWrapper: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: "#F0F2F5", backgroundColor: "#FFF" },
  commentInput: { flex: 1, backgroundColor: "#F0F2F5", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, fontSize: 13.5 },
 scrollTopFloatingBtn: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BDU_RED,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 99,
    gap: 6
  },
  scrollTopText: {
    color: '#FFF',
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: 0.3
  }
});
