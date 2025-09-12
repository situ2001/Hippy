import React from 'react';
import {
  Text,
  View,
} from '@hippy/react';

const Expand = (props) => {
  const { children, expanded, onPress } = props;

  const handleViewClick = () => {
    if (onPress) {
      onPress(!expanded);
    }
  };

  return (
    <View style={{
      paddingTop: 32,
      paddingBottom: 32,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    }}
      onClick={handleViewClick}>
      {children}
    </View>
  );
};

export default function BugExpo() {
  const [expanded, setExpand] = React.useState(false);

  // situ: 安卓有 bug
  // 从现象来看，是 React 在 re-render 后 diff patch 出了错误的 UI
  return <View>
    <Text>点击下面的文字即可复现 bug</Text>
    <Expand
      expanded={expanded}
      onPress={setExpand}
    >
      {!expanded
        ? (
          <View>
            <Text>我不应该会消失A</Text>
            <Text>第也不应该会消失A</Text>
            <Text>我应该是黑色</Text>
            <Text style={{ color: '#ff6600' }}>我应该是橙色</Text>
          </View>
        )
        : (
          <View>
            <Text>我不应该会消失B</Text>
            <Text>第也不应该会消失B</Text>
            <Text style={{ color: '#ff6600' }}>我应该是橙色</Text>
            <Text>我应该是黑色</Text>
          </View>
        )
      }
    </Expand>
  </View>;
}
