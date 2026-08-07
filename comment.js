import React, { useEffect, useState, useRef } from 'react';
import { 
  StyleSheet, Text, View, FlatList, TouchableOpacity, 
  Image, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { 
  collection, query, onSnapshot, addDoc, Timestamp, doc, 
  updateDoc, deleteDoc, orderBy, increment, arrayUnion, arrayRemove, getDoc 
} from "firebase/firestore"; 
import { auth, db } from "../../BDU_SocialApp/firebaseConfig"; 
import Toast from 'react-native-toast-message';

const BDU_RED = '#C8102E';

const getTimeAgo = (timestamp) => {
  if (!timestamp) return "Vừa xong";
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

const CommentItem = ({ cmt, isReply, handleCommentOptions, handleReply, currentUser, activePostId }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const hasLiked = cmt.likedBy && cmt.likedBy.includes(currentUser.id);
  const hasDisliked = cmt.dislikedBy && cmt.dislikedBy.includes(currentUser.id);
  
  const likesCount = cmt.likedBy ? cmt.likedBy.length : 0;
  const dislikesCount = cmt.dislikedBy ? cmt.dislikedBy.length : 0;

  const onReact = async (type) => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.5, duration: 150, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 150, useNativeDriver: true })
    ]).start();

    if (!activePostId || !currentUser.id) return;
    const commentRef = doc(db, "posts", activePostId, "comments", cmt.id);

    try {
      if (type === 'like') {
        if (hasLiked) {
          await updateDoc(commentRef, { likedBy: arrayRemove(currentUser.id) });
        } else {
          await updateDoc(commentRef, {
            likedBy: arrayUnion(currentUser.id),
            ...(hasDisliked ? { dislikedBy: arrayRemove(currentUser.id) } : {})
          });
        }
      } else if (type === 'dislike') {
        if (hasDisliked) {
          await updateDoc(commentRef, { dislikedBy: arrayRemove(currentUser.id) });
        } else {
          await updateDoc(commentRef, {
            dislikedBy: arrayUnion(currentUser.id),
            ...(hasLiked ? { likedBy: arrayRemove(currentUser.id) } : {})
          });
        }
      }
    } catch (error) {
      console.log("Lỗi tương tác bình luận: ", error);
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
          
          <TouchableOpacity onPress={() => onReact('like')} style={{ paddingHorizontal: 5, flexDirection: 'row', alignItems: 'center' }}>
            <Animated.View style={hasLiked ? { transform: [{ scale: scaleAnim }] } : {}}>
              <Ionicons name={hasLiked ? "thumbs-up" : "thumbs-up-outline"} size={16} color={hasLiked ? BDU_RED : '#65676B'} />
            </Animated.View>
            {likesCount > 0 && <Text style={{ fontSize: 12, color: '#65676B', marginLeft: 4 }}>{likesCount}</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => onReact('dislike')} style={{ paddingHorizontal: 5, flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name={hasDisliked ? "thumbs-down" : "thumbs-down-outline"} size={16} color={hasDisliked ? '#1A1A1A' : '#65676B'} />
            {dislikesCount > 0 && <Text style={{ fontSize: 12, color: '#65676B', marginLeft: 4 }}>{dislikesCount}</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => handleReply(cmt)}>
            <Text style={styles.commentActionText}>Phản hồi</Text>
          </TouchableOpacity>
          {currentUser.id === cmt.userId && (
            <TouchableOpacity onPress={() => handleCommentOptions(cmt)}>
              <Text style={styles.commentActionText}>Tùy chọn</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

export default function CommentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const postId = params.postId;

  const [currentUser, setCurrentUser] = useState({ id: null, name: "", avatar: "" });
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [isCommenting, setIsCommenting] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingCommentId, setEditingCommentId] = useState(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      const fetchUser = async () => {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setCurrentUser({
            id: user.uid,
            name: data.fullName || data.name || "Sinh viên BDU",
            avatar: data.avatar || "https://i.pravatar.cc/100?img=1"
          });
        }
      };
      fetchUser();
    }
  }, []);

  useEffect(() => {
    if (!postId) return;
    const q = query(collection(db, "posts", postId, "comments"), orderBy("time", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setComments(data);
    });
    return () => unsubscribe();
  }, [postId]);

  const handleSendComment = async () => {
    if (commentText.trim() === "" || !postId) return;
    setIsCommenting(true);

    try {
      if (editingCommentId) {
        await updateDoc(doc(db, "posts", postId, "comments", editingCommentId), { text: commentText });
        setEditingCommentId(null);
      } else {
        await addDoc(collection(db, "posts", postId, "comments"), {
          author: currentUser.name,
          avatar: currentUser.avatar,
          userId: currentUser.id,
          text: commentText,
          time: Timestamp.now(),
          parentId: replyingTo ? replyingTo.id : null,
        });

        if (!replyingTo) {
          await updateDoc(doc(db, "posts", postId), { comments: increment(1) });
        }
      }

      setCommentText("");
      setReplyingTo(null);
      Toast.show({ type: "success", text1: "Đã gửi bình luận" });
    } catch (error) {
      console.log("Lỗi gửi bình luận:", error);
      Toast.show({ type: "error", text1: "Không thể gửi bình luận" });
    } finally {
      setIsCommenting(false);
    }
  };

  const handleCommentOptions = (cmt) => {
    Alert.alert("Tùy chọn bình luận", "Bạn muốn làm gì?", [
      { text: "Chỉnh sửa", onPress: () => { setCommentText(cmt.text); setEditingCommentId(cmt.id); setReplyingTo(null); } },
      { text: "Xóa", style: "destructive", onPress: async () => {
          await deleteDoc(doc(db, "posts", postId, "comments", cmt.id));
          if (!cmt.parentId) await updateDoc(doc(db, "posts", postId), { comments: increment(-1) });
          Toast.show({ type: "success", text1: "Đã xóa bình luận" });
        } 
      },
      { text: "Hủy", style: "cancel" }
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFF' }} edges={['top', 'bottom']}>
      {/* Header trang bình luận */}
      <View style={styles.commentHeader}>
        <TouchableOpacity onPress={() => router.back()} style={{ position: 'absolute', left: 16 }}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.modalTitle}>Bình luận</Text>
      </View>

      {/* Sử dụng KeyboardAvoidingView chuẩn xác đẩy khung nhập liệu lên sát bàn phím */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"} 
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
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
              activePostId={postId}
            />
          )}
          contentContainerStyle={{ padding: 15 }}
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          ListEmptyComponent={<Text style={{ textAlign: "center", marginTop: 40, color: "#888" }}>Chưa có bình luận nào.</Text>}
        />

        {replyingTo && (
          <View style={styles.replyBanner}>
            <Text style={styles.replyBannerText}>Đang phản hồi {replyingTo.author}</Text>
            <TouchableOpacity onPress={() => setReplyingTo(null)}>
              <Ionicons name="close" size={16} color="#65676B" />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.commentInputWrapper}>
          <TextInput
            style={styles.commentInput}
            placeholder="Viết bình luận..."
            placeholderTextColor="#8A8D91"
            value={commentText}
            onChangeText={setCommentText}
          />
          <TouchableOpacity disabled={isCommenting} onPress={handleSendComment} activeOpacity={0.7} style={styles.sendBtn}>
            {isCommenting ? <ActivityIndicator size="small" color={BDU_RED} /> : <Ionicons name="send" size={22} color={BDU_RED} />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  commentHeader: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: BDU_RED, paddingVertical: 16, position: 'relative' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  commentItem: { flexDirection: 'row', marginBottom: 15 },
  commentAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10, borderWidth: 1, borderColor: '#E4E6EB' },
  commentBubble: { backgroundColor: '#F0F2F5', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, flexShrink: 1, alignSelf: 'flex-start' },
  commentAuthor: { fontWeight: '800', fontSize: 13, color: '#1A1A1A', marginBottom: 2 },
  commentText: { fontSize: 14, color: '#2C2C2C', lineHeight: 20 },
  commentActionsWrap: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginLeft: 10, gap: 10 },
  commentTimeText: { fontSize: 12, color: '#8A8D91', fontWeight: '500' },
  commentActionText: { fontSize: 12, color: '#65676B', fontWeight: '700' },
  replyBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F0F2F5', paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#E4E6EB' },
  replyBannerText: { fontSize: 13, color: '#65676B', fontWeight: '600' },
  replyCommentItem: { marginLeft: 45, marginTop: 2, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: '#E4E6EB' },
  
  // Điều chỉnh khung nhập liệu dính sát đáy và nổi trên bàn phím chuẩn xác
  commentInputWrapper: { 
    flexDirection: "row", 
    alignItems: "center", 
    paddingHorizontal: 15, 
    paddingVertical: 10, 
    borderTopWidth: 1, 
    borderTopColor: "#E4E6EB", 
    backgroundColor: "#FFF",
    paddingBottom: Platform.OS === 'ios' ? 20 : 10
  },
  commentInput: { 
    flex: 1, 
    backgroundColor: "#F3F4F6", 
    borderRadius: 22, 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    marginRight: 10, 
    fontSize: 14,
    color: '#1A1A1A',
    maxHeight: 100
  },
  sendBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 6
  }
}); 
