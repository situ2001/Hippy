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
            <Text>点我，我必定会消失</Text>
            <Text>第二次见我我就不是黑色了</Text>
            <Text style={{ color: '#ff6600' }}>下次，你只能看到这行了</Text>
          </View>
        )
        : (
          <View>
            <Text>点击收起</Text>
            <Text style={{ color: '#ff6600' }}>点击收起</Text>
            <Text>我被继承了之前状态的的样式（原先为黑色字体）</Text>
          </View>
        )
      }
    </Expand>
  </View>;
}

