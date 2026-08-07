import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Modal, Switch, ActivityIndicator, Dimensions, Animated, Easing 
} from 'react-native';
import { Ionicons, FontAwesome5, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { getAuth, signOut } from 'firebase/auth';
import { db } from '../../BDU_SocialApp/firebaseConfig';
import { doc, updateDoc, getDoc, collection, query, limit, getDocs } from 'firebase/firestore';

const BDU_RED = '#C8102E';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function MenuScreen({ currentUser, setActiveTab }) {
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [helpModalVisible, setHelpModalVisible] = useState(false);
  const [eventsModalVisible, setEventsModalVisible] = useState(false);
  
  // MODAL CHO TÍNH NĂNG MẠNG XÃ HỘI
  const [leaderboardModalVisible, setLeaderboardModalVisible] = useState(false);
  const [momentsModalVisible, setMomentsModalVisible] = useState(false);
  const [topUsers, setTopUsers] = useState([]);
  const [loadingTop, setLoadingTop] = useState(false);

  // --- STATE CÀI ĐẶT THỰC TẾ ---
  const [pushNotif, setPushNotif] = useState(true);
  const [activeStatus, setActiveStatus] = useState(true);

  // ✨ ANIMATION XỊN XÒ: HIỆU ỨNG SPRING SCALE & FADE ĐÀN HỒI CAO CẤP
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();

    const fetchUserSettings = async () => {
      const auth = getAuth();
      if (auth.currentUser) {
        const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data.settings?.pushNotif !== undefined) {
            setPushNotif(data.settings.pushNotif);
          }
          if (data.settings?.activeStatus !== undefined) {
            setActiveStatus(data.settings.activeStatus);
          }
        }
      }
    };
    fetchUserSettings();
  }, []);

  const handleTogglePushNotif = async (value) => {
    setPushNotif(value);
    const auth = getAuth();
    if (auth.currentUser) {
      try {
        await updateDoc(doc(db, "users", auth.currentUser.uid), {
          "settings.pushNotif": value
        });
      } catch (error) {
        console.log("Lỗi lưu cài đặt thông báo:", error);
      }
    }
  };

  const handleToggleActiveStatus = async (value) => {
    setActiveStatus(value);
    const auth = getAuth();
    if (auth.currentUser) {
      try {
        await updateDoc(doc(db, "users", auth.currentUser.uid), {
          "settings.activeStatus": value
        });
      } catch (error) {
        console.log("Lỗi lưu trạng thái hoạt động:", error);
      }
    }
  };

  const fetchLeaderboard = async () => {
    setLeaderboardModalVisible(true);
    setLoadingTop(true);
    try {
      const q = query(collection(db, "users"), limit(5));
      const querySnapshot = await getDocs(q);
      const list = [];
      querySnapshot.forEach((docItem) => {
        list.push({ id: docItem.id, ...docItem.data() });
      });
      setTopUsers(list);
    } catch (error) {
      console.log("Lỗi tải bảng xếp hạng:", error);
    } finally {
      setLoadingTop(false);
    }
  };

  const handleLogoutConfirm = () => {
    setLogoutModalVisible(false);
    const auth = getAuth();
    signOut(auth).then(() => {
      router.replace('/'); 
    }).catch((error) => console.log(error));
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ height: 12 }} />

        {/* THẺ PROFILE CÁ NHÂN */}
        <TouchableOpacity 
          style={styles.profileCard} 
          activeOpacity={0.8}
          onPress={() => router.push('/profile')}
        >
          <Image source={{ uri: currentUser?.avatar || 'https://image.dienthoaivui.com.vn/x,webp,q90/https://media-asset.dienthoaivui.com.vn/uploads/dashboard/editor_upload/nen-trang-tron-dep-mien-phi.jpg' }} style={styles.avatar} />
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{currentUser?.name || "Người dùng BDU"}</Text>
            <Text style={styles.profileSub}>Xem trang cá nhân của bạn</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#8A8D91" style={{marginLeft: 'auto'}} />
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* LƯỚI TÍNH NĂNG MẠNG XÃ HỘI */}
        <View style={styles.menuGrid}>
          <TouchableOpacity style={styles.menuGridItem} activeOpacity={0.7} onPress={() => router.push('/FriendListScreen')}>
            <View style={[styles.gridIconBg, { backgroundColor: '#E7F3FF' }]}>
              <Ionicons name="people" size={22} color="#0866FF" />
            </View>
            <Text style={styles.menuGridText}>Bạn bè</Text>
            <Text style={styles.menuGridSub}>Quản lý kết nối</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuGridItem} activeOpacity={0.7} onPress={() => setEventsModalVisible(true)}>
            <View style={[styles.gridIconBg, { backgroundColor: '#FFF0F2' }]}>
              <MaterialCommunityIcons name="calendar-star" size={22} color={BDU_RED} />
            </View>
            <Text style={styles.menuGridText}>Sự kiện BDU</Text>
            <Text style={styles.menuGridSub}>Hoạt động trường</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuGridItem} activeOpacity={0.7} onPress={fetchLeaderboard}>
            <View style={[styles.gridIconBg, { backgroundColor: '#FEF9E7' }]}>
              <FontAwesome5 name="crown" size={18} color="#F1C40F" />
            </View>
            <Text style={styles.menuGridText}>Bảng vàng BDU</Text>
            <Text style={styles.menuGridSub}>Top năng động</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuGridItem} activeOpacity={0.7} onPress={() => setMomentsModalVisible(true)}>
            <View style={[styles.gridIconBg, { backgroundColor: '#E8F8F5' }]}>
              <Ionicons name="images" size={22} color="#2ECC71" />
            </View>
            <Text style={styles.menuGridText}>Khoảnh khắc</Text>
            <Text style={styles.menuGridSub}>Góc sống ảo BDU</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* DANH SÁCH TÙY CHỌN HỆ THỐNG */}
        <View style={styles.optionsList}>
          <TouchableOpacity style={styles.optionItem} activeOpacity={0.7} onPress={() => setSettingsModalVisible(true)}>
            <View style={styles.optionIconBg}><Ionicons name="settings-sharp" size={20} color="#4B4C4F" /></View>
            <Text style={styles.optionText}>Cài đặt & quyền riêng tư</Text>
            <Ionicons name="chevron-forward" size={18} color="#8A8D91" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.optionItem} activeOpacity={0.7} onPress={() => setHelpModalVisible(true)}>
            <View style={styles.optionIconBg}><Ionicons name="help-circle" size={20} color="#4B4C4F" /></View>
            <Text style={styles.optionText}>Trợ giúp & hỗ trợ</Text>
            <Ionicons name="chevron-forward" size={18} color="#8A8D91" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutBtn} activeOpacity={0.8} onPress={() => setLogoutModalVisible(true)}>
            <Ionicons name="log-out-outline" size={20} color="#FFF" style={{marginRight: 8}} />
            <Text style={styles.logoutBtnText}>Đăng xuất</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* MODAL ĐĂNG XUẤT (HOÀN TOÀN TRONG SUỐT KHÔNG CÒN NỀN ĐEN) */}
      <Modal visible={logoutModalVisible} transparent={true} animationType="fade">
        <View style={styles.transparentOverlay}>
          <TouchableOpacity style={{flex: 1, width: '100%'}} activeOpacity={1} onPress={() => setLogoutModalVisible(false)}>
            <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
              <View style={styles.alertBox}>
                <View style={styles.alertIconWrap}>
                  <Ionicons name="warning" size={32} color="#FF9500" />
                </View>
                <Text style={styles.alertTitle}>Xác nhận đăng xuất</Text>
                <Text style={styles.alertMessage}>Bạn có chắc chắn muốn thoát khỏi tài khoản này không?</Text>
                <View style={styles.alertActionRow}>
                  <TouchableOpacity style={styles.alertBtnCancel} onPress={() => setLogoutModalVisible(false)}>
                    <Text style={styles.alertBtnCancelText}>Hủy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.alertBtnConfirm} onPress={handleLogoutConfirm}>
                    <Text style={styles.alertBtnConfirmText}>Đăng xuất</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* MODAL SỰ KIỆN BDU */}
      <Modal visible={eventsModalVisible} transparent={true} animationType="slide">
        <View style={styles.transparentOverlay}>
          <TouchableOpacity style={{flex: 1}} activeOpacity={1} onPress={() => setEventsModalVisible(false)} />
          <View style={styles.bottomSheetContainer}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Sự kiện nổi bật</Text>
            
            <View style={styles.eventCard}>
              <View style={styles.eventDate}>
                <Text style={styles.eventMonth}>THG 10</Text>
                <Text style={styles.eventDay}>25</Text>
              </View>
              <View style={{flex: 1}}>
                <Text style={styles.eventName}>Ngày hội Việc làm IT 2026</Text>
                <Text style={styles.eventLoc}>Hội trường A - Đại học BDU</Text>
              </View>
            </View>

            <View style={styles.eventCard}>
              <View style={[styles.eventDate, { backgroundColor: '#F0F2F5' }]}>
                <Text style={[styles.eventMonth, {color: '#65676B'}]}>THG 11</Text>
                <Text style={[styles.eventDay, {color: '#1A1A1A'}]}>02</Text>
              </View>
              <View style={{flex: 1}}>
                <Text style={styles.eventName}>Chung kết: BDU Got Talent</Text>
                <Text style={styles.eventLoc}>Sân khấu ngoài trời</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.sheetCloseBtn} onPress={() => setEventsModalVisible(false)}>
              <Text style={styles.sheetCloseText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL BẢNG VÀNG BDU */}
      <Modal visible={leaderboardModalVisible} transparent={true} animationType="slide">
        <View style={styles.transparentOverlay}>
          <TouchableOpacity style={{flex: 1}} activeOpacity={1} onPress={() => setLeaderboardModalVisible(false)} />
          <View style={[styles.bottomSheetContainer, {maxHeight: '70%'}]}>
            <View style={styles.sheetHandle} />
            <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 15}}>
              <FontAwesome5 name="crown" size={20} color="#F1C40F" style={{marginRight: 8}} />
              <Text style={[styles.sheetTitle, {marginBottom: 0}]}>Bảng vàng tương tác</Text>
            </View>
            
            {loadingTop ? (
              <ActivityIndicator size="small" color={BDU_RED} style={{marginVertical: 30}} />
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {topUsers.map((u, idx) => (
                  <View key={u.id} style={styles.leaderboardItem}>
                    <Text style={[styles.rankText, idx === 0 && {color: '#F1C40F'}, idx === 1 && {color: '#95A5A6'}, idx === 2 && {color: '#D35400'}]}>
                      #{idx + 1}
                    </Text>
                    <Image source={{ uri: u.avatar || 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png' }} style={styles.leaderboardAvatar} />
                    <View style={{flex: 1, marginLeft: 12}}>
                      <Text style={styles.leaderboardName}>{u.name || "Sinh viên BDU"}</Text>
                      <Text style={styles.leaderboardMajor}>{u.major || "Thành viên tích cực"}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity style={styles.sheetCloseBtn} onPress={() => setLeaderboardModalVisible(false)}>
              <Text style={styles.sheetCloseText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL KHOẢNH KHẮC CAMPUS */}
      <Modal visible={momentsModalVisible} transparent={true} animationType="slide">
        <View style={styles.transparentOverlay}>
          <TouchableOpacity style={{flex: 1}} activeOpacity={1} onPress={() => setMomentsModalVisible(false)} />
          <View style={styles.bottomSheetContainer}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Khoảnh khắc BDU</Text>
            <Text style={{fontSize: 13, color: '#65676B', marginBottom: 15}}>Góc check-in và sống ảo cực chill của sinh viên Đại học Bình Dương.</Text>
            
            <View style={styles.momentBanner}>
              <Image source={{ uri: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=600&q=80' }} style={{width: '100%', height: 160, borderRadius: 12}} />
              <Text style={styles.momentCaption}>Sân trường BDU rợp bóng cây xanh vào buổi sáng ✨</Text>
            </View>

            <TouchableOpacity style={styles.sheetCloseBtn} onPress={() => setMomentsModalVisible(false)}>
              <Text style={styles.sheetCloseText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL CÀI ĐẶT & QUYỀN RIÊNG TƯ */}
      <Modal visible={settingsModalVisible} transparent={true} animationType="slide">
        <View style={styles.transparentOverlay}>
          <TouchableOpacity style={{flex: 1}} activeOpacity={1} onPress={() => setSettingsModalVisible(false)} />
          <View style={styles.bottomSheetContainer}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Cài đặt & Quyền riêng tư</Text>
            
            <View style={styles.settingRow}>
              <View style={{flexDirection: 'row', alignItems: 'center', flex: 1}}>
                <Ionicons name="notifications-outline" size={22} color="#0866FF" style={{marginRight: 12}} />
                <View style={{flex: 1}}>
                  <Text style={styles.settingText}>Nhận thông báo Push</Text>
                  <Text style={styles.settingSub}>Nhận thông báo khi có tương tác mới</Text>
                </View>
              </View>
              <Switch 
                value={pushNotif} 
                onValueChange={handleTogglePushNotif} 
                trackColor={{ false: "#CCD0D5", true: "#34C759" }} 
                thumbColor="#FFF"
              />
            </View>

            <View style={styles.settingRow}>
              <View style={{flexDirection: 'row', alignItems: 'center', flex: 1}}>
                <Ionicons name="radio-button-on" size={22} color="#2ECC71" style={{marginRight: 12}} />
                <View style={{flex: 1}}>
                  <Text style={styles.settingText}>Trạng thái hoạt động</Text>
                  <Text style={styles.settingSub}>Hiển thị khi bạn online trên Radar</Text>
                </View>
              </View>
              <Switch 
                value={activeStatus} 
                onValueChange={handleToggleActiveStatus} 
                trackColor={{ false: "#CCD0D5", true: "#34C759" }} 
                thumbColor="#FFF"
              />
            </View>

            <TouchableOpacity style={styles.sheetCloseBtn} onPress={() => setSettingsModalVisible(false)}>
              <Text style={styles.sheetCloseText}>Hoàn tất</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL TRỢ GIÚP */}
      <Modal visible={helpModalVisible} transparent={true} animationType="fade">
        <View style={styles.transparentOverlay}>
          <TouchableOpacity style={{flex: 1, width: '100%'}} activeOpacity={1} onPress={() => setHelpModalVisible(false)}>
            <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
              <View style={styles.alertBox}>
                <Ionicons name="headset" size={36} color={BDU_RED} style={{marginBottom: 10}} />
                <Text style={styles.alertTitle}>Trung tâm hỗ trợ</Text>
                <Text style={styles.alertMessage}>Nếu bạn gặp lỗi hoặc có góp ý phát triển ứng dụng, vui lòng liên hệ:</Text>
                <View style={{width: '100%', marginTop: 10, backgroundColor: '#F4F6F9', padding: 12, borderRadius: 8}}>
                  <Text style={{fontSize: 13, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 4}}>Email: <Text style={{fontWeight: 'normal'}}>G5cappss@gmail.com</Text></Text>
                  <Text style={{fontSize: 13, fontWeight: 'bold', color: '#1A1A1A'}}>Hotline: <Text style={{fontWeight: 'normal'}}>0967374054</Text></Text>
                </View>
                <TouchableOpacity style={[styles.alertBtnConfirm, {width: '100%', marginTop: 15}]} onPress={() => setHelpModalVisible(false)}>
                  <Text style={styles.alertBtnConfirmText}>Đã hiểu</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </Modal>

    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F2F5' },
  
  profileCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FFF', 
    marginHorizontal: 16, 
    padding: 12, 
    borderRadius: 16, 
    borderWidth: 1.2,
    borderColor: '#C8102E',
    shadowColor: '#C8102E', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.08, 
    shadowRadius: 6, 
    elevation: 3 
  },
  avatar: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: '#E4E6EB' },
  profileInfo: { marginLeft: 12 },
  profileName: { fontSize: 16, fontWeight: 'bold', color: '#1A1A1A' },
  profileSub: { fontSize: 13, color: '#65676B', marginTop: 2 },
  
  divider: { height: 1, backgroundColor: '#E4E6EB', marginVertical: 16, marginHorizontal: 16 },
  
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 10, justifyContent: 'space-between' },
  menuGridItem: { width: '47%', backgroundColor: '#FFF', marginHorizontal: '1.5%', marginBottom: 12, padding: 14, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 1 },
  gridIconBg: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  menuGridText: { fontSize: 14.5, fontWeight: '700', color: '#1A1A1A' },
  menuGridSub: { fontSize: 11.5, color: '#8A8D91', marginTop: 2 },
  
  optionsList: { paddingHorizontal: 16, paddingBottom: 40 },
  optionItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.02, shadowRadius: 2, elevation: 1 },
  optionIconBg: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#F0F2F5', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  optionText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
  
  logoutBtn: { 
    marginTop: 10, 
    backgroundColor: BDU_RED, 
    flexDirection: 'row',
    paddingVertical: 14, 
    borderRadius: 12, 
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BDU_RED,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4
  },
  logoutBtnText: { fontSize: 15.5, fontWeight: '800', color: '#FFF' },

  // 🌟 ĐÃ XÓA HOÀN TOÀN NỀN ĐEN, CHUYỂN THÀNH TRANSPARENT SẠCH SẼ
  transparentOverlay: { flex: 1, backgroundColor: 'transparent', justifyContent: 'flex-end' },
  
  alertBox: { width: '80%', backgroundColor: '#FFF', borderRadius: 20, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, elevation: 10, borderWidth: 1, borderColor: '#F0F2F5' },
  alertIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFF4E5', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  alertTitle: { fontSize: 17, fontWeight: '800', color: '#1A1A1A', marginBottom: 6, textAlign: 'center' },
  alertMessage: { fontSize: 13.5, color: '#65676B', textAlign: 'center', marginBottom: 20, lineHeight: 19 },
  alertActionRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', gap: 10 },
  alertBtnCancel: { flex: 1, backgroundColor: '#F0F2F5', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  alertBtnCancelText: { fontSize: 14.5, fontWeight: '700', color: '#4A4A4A' },
  alertBtnConfirm: { flex: 1, backgroundColor: BDU_RED, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  alertBtnConfirmText: { fontSize: 14.5, fontWeight: '700', color: '#FFF' },

  bottomSheetContainer: { 
    backgroundColor: '#FFF', 
    borderTopLeftRadius: 24, 
    borderTopRightRadius: 24, 
    padding: 20, 
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 15,
    borderTopWidth: 1,
    borderTopColor: '#E4E6EB'
  },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#E4E6EB', borderRadius: 2, alignSelf: 'center', marginBottom: 15 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: '#1A1A1A', marginBottom: 15 },
  sheetCloseBtn: { marginTop: 20, backgroundColor: '#F0F2F5', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  sheetCloseText: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },

  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F2F5' },
  settingText: { fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
  settingSub: { fontSize: 12, color: '#8A8D91', marginTop: 2 },

  eventCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#F0F2F5', padding: 12, borderRadius: 12, marginBottom: 12 },
  eventDate: { width: 52, height: 52, backgroundColor: '#FFF0F2', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  eventMonth: { fontSize: 11, fontWeight: 'bold', color: BDU_RED },
  eventDay: { fontSize: 17, fontWeight: '800', color: BDU_RED },
  eventName: { fontSize: 15, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 3 },
  eventLoc: { fontSize: 12.5, color: '#65676B' },

  leaderboardItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F4F6F9' },
  rankText: { fontSize: 16, fontWeight: '800', width: 30, color: BDU_RED, textAlign: 'center' },
  leaderboardAvatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#E4E6EB' },
  leaderboardName: { fontSize: 15, fontWeight: '700', color: '#1A1A1A' },
  leaderboardMajor: { fontSize: 12, color: '#65676B', marginTop: 1 },

  momentBanner: { marginTop: 5 },
  momentCaption: { fontSize: 13.5, fontWeight: '600', color: '#1A1A1A', marginTop: 10, textAlign: 'center' }
});
