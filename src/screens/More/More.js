import React from "react";
import { StyleSheet, View, Image } from "react-native";
import { useSelector } from "react-redux";

import { Appbar } from "../../components/Appbar";
import { ListItem, ListSection } from "../../components/List";

const MoreScreen = ({ navigation }) => {
    const theme = useSelector((state) => state.themeReducer.theme);

    return (
        <>
            <Appbar title="More" style={{ elevation: 0 }} />
            <View style={{ flex: 1, backgroundColor: theme.colorPrimaryDark }}>
                <View style={{ overflow: "hidden", paddingBottom: 4 }}>
                    <View
                        style={{
                            paddingTop: 20,
                            paddingBottom: 30,
                            alignItems: "center",
                            backgroundColor: theme.colorPrimary,
                            elevation: 4,
                        }}
                    >
                        <Image
                            source={require("../../../assets/logo.png")}
                            style={{
                                height: 60,
                                width: 60,
                                tintColor: theme.textColorPrimary,
                            }}
                        />
                    </View>
                </View>
                <ListSection>
                    <ListItem
                        title="Settings"
                        icon="cog-outline"
                        onPress={() =>
                            navigation.navigate("SettingsStack", {
                                screen: "Settings",
                            })
                        }
                        theme={theme}
                    />
                    <ListItem
                        title="About"
                        icon="information-outline"
                        onPress={() =>
                            navigation.navigate("SettingsStack", {
                                screen: "About",
                            })
                        }
                        theme={theme}
                    />
                </ListSection>
            </View>
        </>
    );
};

export default MoreScreen;

const styles = StyleSheet.create({});
