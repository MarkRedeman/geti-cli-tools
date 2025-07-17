const body = {
    name: 'Project',
    pipeline: {
        connections: [
            {
                from: 'Dataset',
                to: 'Classification',
            },
        ],
        tasks: [
            {
                title: 'Dataset',
                task_type: 'dataset',
            },
            {
                title: 'Classification',
                task_type: 'classification',
                labels: [
                    {
                        name: '7',
                        color: '#5b69ffff',
                        group: 'Value',
                        parent_id: null,
                    },
                    {
                        name: '8',
                        color: '#80e9afff',
                        group: 'Value',
                        parent_id: null,
                    },
                    {
                        name: '9',
                        color: '#81407bff',
                        group: 'Value',
                        parent_id: null,
                    },
                    {
                        name: '10',
                        color: '#cc94daff',
                        group: 'Value',
                        parent_id: null,
                    },
                    {
                        name: 'J',
                        color: '#708541ff',
                        group: 'Value',
                        parent_id: null,
                    },
                    {
                        name: 'Q',
                        color: '#edb200ff',
                        group: 'Value',
                        parent_id: null,
                    },
                    {
                        name: 'K',
                        color: '#076984ff',
                        group: 'Value',
                        parent_id: null,
                    },
                    {
                        name: 'A',
                        color: '#f15b85ff',
                        group: 'Value',
                        parent_id: null,
                    },
                    {
                        name: 'Spades',
                        color: '#00a5cfff',
                        group: 'Suit',
                        parent_id: null,
                    },
                    {
                        name: 'Clubs',
                        color: '#ff7d00ff',
                        group: 'Suit',
                        parent_id: null,
                    },
                    {
                        name: 'Diamonds',
                        color: '#d7bc5eff',
                        group: 'Suit',
                        parent_id: null,
                    },
                    {
                        name: 'Hearts',
                        color: '#cc94daff',
                        group: 'Suit',
                        parent_id: null,
                    },
                ],
            },
        ],
    },
};
